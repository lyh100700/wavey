package com.wavey.player;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

/**
 * 지금 듣고 있는 곡을 전화 벨소리 · 알림음 · 알람음으로 지정한다.
 *
 * ── 왜 자바로 만들어야 하나 ──
 *
 * 곡 파일은 앱 안쪽(웹 저장소)에만 들어 있어서, 폰의 다른 앱들은 볼 수 없다.
 * 벨소리로 쓰이려면 전화 앱도 읽을 수 있는 공용 '벨소리' 폴더에 사본이 있어야
 * 하는데, 그 폴더에 파일을 넣는 일은 웹 쪽에서 할 수 없다.
 *
 * 그래서 웹 화면이 파일 내용을 글자로 바꿔(base64) 이쪽에 넘겨 주면,
 * 여기서 공용 폴더에 파일을 만들고 시스템에 "이건 벨소리다"라고 등록한 뒤,
 * 기본 벨소리로 지정까지 해 준다.
 *
 * ── 안드로이드가 요구하는 두 가지 허락 ──
 *
 * 1) 파일을 공용 폴더에 넣을 권한
 *    안드로이드 10부터는 필요 없다. 그보다 낮은 버전에서만 저장 권한을 묻는다.
 *
 * 2) 시스템 설정을 바꿀 권한 (기본 벨소리 지정)
 *    이건 팝업으로 묻는 게 아니라 설정 화면으로 보내야 하는 특별한 권한이라,
 *    canWriteSettings / openWriteSettings 를 따로 뒀다.
 */
@CapacitorPlugin(
    name = "WaveyRingtone",
    permissions = {
        @Permission(
            strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE },
            alias = WaveyRingtonePlugin.STORAGE
        )
    }
)
public class WaveyRingtonePlugin extends Plugin {

    static final String STORAGE = "storage";

    /* ── 시스템 설정 변경 권한 ──────────────────────────────── */

    /** 지금 기본 벨소리를 바꿀 수 있는 상태인지. */
    @PluginMethod
    public void canWriteSettings(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", mayWriteSettings());
        call.resolve(result);
    }

    /** 권한을 켜는 시스템 설정 화면을 연다. 돌아오면 다시 확인해서 알려 준다. */
    @PluginMethod
    public void openWriteSettings(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
            JSObject result = new JSObject();
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_WRITE_SETTINGS,
            Uri.parse("package:" + getContext().getPackageName())
        );
        startActivityForResult(call, intent, "writeSettingsResult");
    }

    /**
     * 설정 화면에서 돌아왔을 때.
     * 이 화면은 "허락함/안 함"을 결과로 주지 않으므로 직접 다시 확인한다.
     */
    @ActivityCallback
    private void writeSettingsResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject payload = new JSObject();
        payload.put("granted", mayWriteSettings());
        call.resolve(payload);
    }

    private boolean mayWriteSettings() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        return Settings.System.canWrite(getContext());
    }

    /* ── 벨소리로 넣기 ─────────────────────────────────────── */

    @PluginMethod
    public void save(PluginCall call) {
        // 안드로이드 10 미만에서만 저장 권한이 필요하다.
        boolean needsStorage =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.Q &&
            getPermissionState(STORAGE) != PermissionState.GRANTED;

        if (needsStorage) {
            requestPermissionForAlias(STORAGE, call, "storageResult");
            return;
        }
        writeAndApply(call);
    }

    @PermissionCallback
    private void storageResult(PluginCall call) {
        if (getPermissionState(STORAGE) != PermissionState.GRANTED) {
            call.reject("저장 권한이 없어서 벨소리 폴더에 넣지 못했어요");
            return;
        }
        writeAndApply(call);
    }

    private void writeAndApply(PluginCall call) {
        String fileName = call.getString("fileName");
        String data = call.getString("data");
        if (fileName == null || fileName.isEmpty() || data == null) {
            call.reject("곡 파일을 받지 못했어요");
            return;
        }

        String title = call.getString("title", fileName);
        String mimeType = call.getString("mimeType", "audio/mpeg");
        String type = call.getString("type", "ringtone");
        boolean setDefault = Boolean.TRUE.equals(call.getBoolean("setDefault", true));

        byte[] bytes;
        try {
            bytes = Base64.decode(data, Base64.DEFAULT);
        } catch (IllegalArgumentException e) {
            call.reject("곡 파일이 깨져 있어요");
            return;
        }

        try {
            Uri uri = storeInPublicFolder(fileName, title, mimeType, type, bytes);

            boolean applied = false;
            if (setDefault && mayWriteSettings()) {
                RingtoneManager.setActualDefaultRingtoneUri(getContext(), ringtoneType(type), uri);
                applied = true;
            }

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            // 파일은 넣었지만 기본 지정까지는 못 한 경우를 웹 쪽에서 구분해야 한다.
            result.put("applied", applied);
            call.resolve(result);
        } catch (Exception e) {
            String message = e.getMessage();
            call.reject(message == null || message.isEmpty() ? "벨소리를 저장하지 못했어요" : message, e);
        }
    }

    /**
     * 공용 벨소리 폴더에 파일을 만들고 시스템 목록(MediaStore)에 등록한다.
     * 안드로이드 10을 기준으로 방식이 크게 달라서 두 갈래로 나뉜다.
     */
    private Uri storeInPublicFolder(
        String fileName,
        String title,
        String mimeType,
        String type,
        byte[] bytes
    ) throws Exception {
        ContentResolver resolver = getContext().getContentResolver();
        String folderName = folderFor(type);

        ContentValues values = new ContentValues();
        values.put(MediaStore.MediaColumns.DISPLAY_NAME, fileName);
        values.put(MediaStore.MediaColumns.TITLE, title);
        values.put(MediaStore.MediaColumns.MIME_TYPE, mimeType);
        // 이 소리가 어느 목록에 보일지 — 벨소리 고르는 화면이 이 표시를 본다.
        values.put(MediaStore.Audio.Media.IS_RINGTONE, "ringtone".equals(type) ? 1 : 0);
        values.put(MediaStore.Audio.Media.IS_NOTIFICATION, "notification".equals(type) ? 1 : 0);
        values.put(MediaStore.Audio.Media.IS_ALARM, "alarm".equals(type) ? 1 : 0);
        values.put(MediaStore.Audio.Media.IS_MUSIC, 0);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            Uri collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY);
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, folderName);
            // 다 쓸 때까지 다른 앱에게 보이지 않게 잠가 둔다.
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);

            // 같은 이름이 남아 있으면 "이름 (1).mp3"이 생겨 목록이 지저분해진다.
            removeSameName(resolver, collection, folderName, fileName);

            Uri uri = resolver.insert(collection, values);
            if (uri == null) throw new Exception("벨소리 폴더에 자리를 만들지 못했어요");

            try (OutputStream out = resolver.openOutputStream(uri)) {
                if (out == null) throw new Exception("벨소리 파일에 쓰지 못했어요");
                out.write(bytes);
            }

            ContentValues unlock = new ContentValues();
            unlock.put(MediaStore.MediaColumns.IS_PENDING, 0);
            resolver.update(uri, unlock, null, null);
            return uri;
        }

        // 안드로이드 9 이하 — 파일을 직접 만든 뒤 목록에 등록한다.
        File folder = Environment.getExternalStoragePublicDirectory(folderName);
        if (!folder.exists() && !folder.mkdirs()) {
            throw new Exception("벨소리 폴더를 만들지 못했어요");
        }
        File file = new File(folder, fileName);
        try (FileOutputStream out = new FileOutputStream(file)) {
            out.write(bytes);
        }

        Uri collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
        String path = file.getAbsolutePath();
        try {
            resolver.delete(collection, MediaStore.MediaColumns.DATA + "=?", new String[] { path });
        } catch (Exception ignored) {
            // 예전 기록을 못 지워도 아래 등록은 대개 성공한다.
        }
        values.put(MediaStore.MediaColumns.DATA, path);
        Uri uri = resolver.insert(collection, values);
        if (uri == null) throw new Exception("벨소리 목록에 등록하지 못했어요");
        return uri;
    }

    /** 같은 폴더에 같은 이름으로 남아 있는 예전 사본을 지운다. */
    private void removeSameName(
        ContentResolver resolver,
        Uri collection,
        String folderName,
        String fileName
    ) {
        try {
            String where =
                MediaStore.MediaColumns.DISPLAY_NAME + "=? AND " +
                MediaStore.MediaColumns.RELATIVE_PATH + " LIKE ?";
            resolver.delete(collection, where, new String[] { fileName, folderName + "%" });
        } catch (Exception ignored) {
            // 다른 앱이 만든 파일은 지울 수 없다. 그 경우는 그냥 새 이름으로 들어간다.
        }
    }

    private String folderFor(String type) {
        if ("notification".equals(type)) return Environment.DIRECTORY_NOTIFICATIONS;
        if ("alarm".equals(type)) return Environment.DIRECTORY_ALARMS;
        return Environment.DIRECTORY_RINGTONES;
    }

    private int ringtoneType(String type) {
        if ("notification".equals(type)) return RingtoneManager.TYPE_NOTIFICATION;
        if ("alarm".equals(type)) return RingtoneManager.TYPE_ALARM;
        return RingtoneManager.TYPE_RINGTONE;
    }
}
