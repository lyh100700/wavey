package com.wavey.player;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;

import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * 새 버전 APK를 내려받아 설치까지 이어 준다.
 *
 * ── 왜 자바로 만들어야 하나 ──
 *
 * 웹 화면만으로는 파일을 폰에 저장할 수도, 설치 화면을 띄울 수도 없다.
 * 그래서 내려받기와 설치 요청을 이쪽에서 맡는다.
 *
 * ── 안드로이드가 요구하는 허락 ──
 *
 * 스토어를 거치지 않고 앱을 설치하는 것은 위험할 수 있어서, 안드로이드 8부터는
 * "이 앱이 앱을 설치하도록 허용" 스위치를 사용자가 직접 켜 줘야 한다.
 * 팝업으로 물을 수 없고 설정 화면으로 보내야 하는 종류라,
 * canInstall / openInstallSettings 를 따로 뒀다.
 *
 * ── 파일을 어디에 두나 ──
 *
 * 앱 전용 폴더(Android/data/com.wavey.player/files/Download)에 둔다.
 * 권한 없이 쓸 수 있고, 앱을 지우면 같이 지워져 쓰레기가 남지 않는다.
 * 설치 화면은 다른 앱이므로 그냥은 이 파일을 볼 수 없어서,
 * FileProvider로 "이 파일 하나만 읽어도 좋다"는 임시 통행증을 만들어 넘긴다.
 */
@CapacitorPlugin(name = "WaveyUpdater")
public class WaveyUpdaterPlugin extends Plugin {

    private static final String PROGRESS_EVENT = "downloadProgress";
    private static final int MAX_REDIRECTS = 5;

    /* ── 설치 허용 여부 ─────────────────────────────────────── */

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", mayInstall());
        call.resolve(result);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                Uri.parse("package:" + getContext().getPackageName())
            );
            startActivityForResult(call, intent, "installSettingsResult");
        } catch (Exception e) {
            // 이 설정 화면이 없는 기기도 있다. 여기서 그냥 두면 웹 쪽이 영영
            // 답을 기다리며 멈추므로, 못 열었다고 분명히 알려 준다.
            JSObject result = new JSObject();
            result.put("granted", false);
            call.resolve(result);
        }
    }

    /** 설정 화면에서 돌아왔을 때. 결과를 주지 않는 화면이라 직접 다시 확인한다. */
    @ActivityCallback
    private void installSettingsResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject payload = new JSObject();
        payload.put("granted", mayInstall());
        call.resolve(payload);
    }

    private boolean mayInstall() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    /* ── 내려받기 ──────────────────────────────────────────── */

    /**
     * APK를 내려받는다. 오래 걸리는 일이라 별도 흐름에서 처리하고,
     * 진행률은 downloadProgress 소식으로 그때그때 알려 준다.
     */
    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("내려받을 주소가 없어요");
            return;
        }
        String fileName = call.getString("fileName", "wavey-update.apk");

        new Thread(() -> {
            try {
                File file = fetch(url, fileName);
                JSObject result = new JSObject();
                result.put("path", file.getAbsolutePath());
                call.resolve(result);
            } catch (Exception e) {
                String message = e.getMessage();
                call.reject(
                    message == null || message.isEmpty() ? "내려받지 못했어요" : message,
                    e
                );
            }
        }).start();
    }

    private File fetch(String url, String fileName) throws Exception {
        File folder = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (folder == null) throw new Exception("파일을 둘 자리를 찾지 못했어요");
        if (!folder.exists() && !folder.mkdirs()) throw new Exception("파일을 둘 자리를 만들지 못했어요");

        File target = new File(folder, fileName);
        // 지난번에 받다 만 파일이 남아 있으면 지우고 새로 받는다.
        if (target.exists() && !target.delete()) {
            throw new Exception("예전 설치 파일을 지우지 못했어요");
        }

        HttpURLConnection connection = open(url);
        try {
            int total = connection.getContentLength();
            long received = 0;
            int lastPercent = -1;

            try (
                InputStream in = connection.getInputStream();
                FileOutputStream out = new FileOutputStream(target)
            ) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    received += read;

                    // 소식을 너무 자주 보내면 화면이 버벅인다. 1%마다 한 번만 보낸다.
                    int percent = total > 0 ? (int) (received * 100 / total) : -1;
                    if (percent != lastPercent) {
                        lastPercent = percent;
                        JSObject progress = new JSObject();
                        progress.put("percent", percent);
                        progress.put("receivedBytes", received);
                        progress.put("totalBytes", total);
                        notifyListeners(PROGRESS_EVENT, progress);
                    }
                }
            }

            if (target.length() == 0) throw new Exception("받은 파일이 비어 있어요");
            return target;
        } finally {
            connection.disconnect();
        }
    }

    /**
     * 주소를 연다. 릴리스 파일은 실제 저장 위치로 몇 번 넘겨지므로(리다이렉트)
     * 그때마다 새 주소로 다시 연다.
     */
    private HttpURLConnection open(String url) throws Exception {
        String next = url;
        for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
            HttpURLConnection connection = (HttpURLConnection) new URL(next).openConnection();
            connection.setConnectTimeout(20000);
            connection.setReadTimeout(60000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("Accept", "application/octet-stream");
            connection.connect();

            int code = connection.getResponseCode();
            boolean moved =
                code == HttpURLConnection.HTTP_MOVED_PERM ||
                code == HttpURLConnection.HTTP_MOVED_TEMP ||
                code == HttpURLConnection.HTTP_SEE_OTHER ||
                code == 307 ||
                code == 308;

            if (moved) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                if (location == null || location.isEmpty()) {
                    throw new Exception("파일이 어디 있는지 알려 주지 않았어요");
                }
                // 상대 주소로 올 수도 있어서 지금 주소를 기준으로 합쳐 준다.
                next = new URL(new URL(next), location).toString();
                continue;
            }

            if (code < 200 || code >= 300) {
                connection.disconnect();
                throw new Exception("서버가 파일을 주지 않았어요 (" + code + ")");
            }
            return connection;
        }
        throw new Exception("주소가 너무 여러 번 바뀌어 포기했어요");
    }

    /* ── 설치 ─────────────────────────────────────────────── */

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null || path.isEmpty()) {
            call.reject("설치할 파일이 없어요");
            return;
        }
        File file = new File(path);
        if (!file.exists()) {
            call.reject("설치 파일을 찾지 못했어요");
            return;
        }

        try {
            Uri uri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            // 설치 화면은 다른 앱이라 새 창으로 열고, 이 파일만 읽도록 허락해 준다.
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            String message = e.getMessage();
            call.reject(
                message == null || message.isEmpty() ? "설치 화면을 열지 못했어요" : message,
                e
            );
        }
    }
}
