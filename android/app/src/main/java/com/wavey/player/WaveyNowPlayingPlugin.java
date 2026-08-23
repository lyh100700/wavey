package com.wavey.player;

import android.Manifest;
import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * 웹 화면과 재생 서비스를 이어 주는 다리.
 *
 * 웹 쪽에서 "지금 이 곡을 이렇게 틀고 있어요"라고 알려 주면(show),
 * 자바 쪽 서비스가 그대로 상단·잠금화면 재생 카드를 그린다.
 * 반대로 사용자가 카드의 ⏮ ⏯ ⏭ 를 누르면 'action' 소식으로 웹에 되돌려 준다.
 *
 * 실제 소리는 여전히 웹 화면의 <audio>가 낸다. 이 다리는 "보여 주는 일"과
 * "누른 것을 전해 주는 일"만 맡는다.
 */
@CapacitorPlugin(
    name = "WaveyNowPlaying",
    permissions = {
        @Permission(
            strings = { Manifest.permission.POST_NOTIFICATIONS },
            alias = WaveyNowPlayingPlugin.NOTIFICATIONS
        )
    }
)
public class WaveyNowPlayingPlugin extends Plugin {

    static final String NOTIFICATIONS = "notifications";

    @Override
    public void load() {
        WaveyPlaybackService.ensureChannel(getContext());
        WaveyPlaybackService.setListener((action, positionMs) -> {
            JSObject data = new JSObject();
            data.put("action", action);
            // 잠금화면 막대를 끌어 옮겼을 때만 뜻이 있는 값이다. 초 단위로 준다.
            data.put("position", positionMs / 1000d);
            notifyListeners("action", data);
        });
    }

    /**
     * 앱이 완전히 끝날 때.
     *
     * 소리를 내는 것은 웹 화면이므로, 화면이 사라지면 소리도 함께 사라진다.
     * 그런데 재생 카드만 남아 있으면 눌러도 아무 일이 없는 유령이 된다.
     * 그래서 여기서 같이 치운다.
     */
    @Override
    protected void handleOnDestroy() {
        WaveyPlaybackService.setListener(null);
        WaveyPlaybackService.hide();
        super.handleOnDestroy();
    }

    /* ── 웹에서 부르는 기능들 ─────────────────────────────── */

    /** 재생 카드를 띄우거나, 이미 떠 있으면 내용을 갈아끼운다. */
    @PluginMethod
    public void show(PluginCall call) {
        try {
            WaveyPlaybackService.NowPlaying info = new WaveyPlaybackService.NowPlaying();
            info.title = call.getString("title", "");
            info.artist = call.getString("artist", "");
            info.album = call.getString("album", "");
            info.playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
            info.positionMs = Math.round(call.getDouble("position", 0d) * 1000);
            info.durationMs = Math.round(call.getDouble("duration", 0d) * 1000);
            info.artwork = call.getString("artwork", null);
            info.artworkKey = call.getString("artworkKey", null);

            WaveyPlaybackService.show(getContext(), info);
            call.resolve();
        } catch (Exception e) {
            // 여기서 막히면 재생 자체가 멈추지는 않는다. 알림만 안 뜰 뿐이다.
            call.reject("재생 카드를 띄우지 못했어요: " + e.getMessage());
        }
    }

    /** 재생 카드를 치운다. */
    @PluginMethod
    public void hide(PluginCall call) {
        WaveyPlaybackService.hide();
        call.resolve();
    }

    /**
     * 알림을 띄울 수 있는 상태인지 확인한다.
     *
     * 안드로이드 13부터는 알림도 사용자 허락이 필요하다. 다만 "권한을 줬는지"만
     * 봐서는 부족하다. 사용자가 설정에서 Wavey 알림을 통째로 꺼 둘 수도 있기
     * 때문이다. areNotificationsEnabled()는 두 경우를 한 번에 알려 준다.
     */
    @PluginMethod
    public void canNotify(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", notificationsEnabled());
        call.resolve(result);
    }

    /**
     * 알림 권한을 물어본다.
     *
     * 안드로이드 13 미만에는 이런 권한 자체가 없다. 그런 폰에 대고 물으면
     * 시스템이 "그런 권한 모른다"며 거절로 답해 버리므로, 아예 묻지 않고
     * 지금 상태를 그대로 돌려준다.
     */
    @PluginMethod
    public void requestNotify(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU || notificationsEnabled()) {
            JSObject result = new JSObject();
            result.put("granted", notificationsEnabled());
            call.resolve(result);
            return;
        }
        requestPermissionForAlias(NOTIFICATIONS, call, "notifyResult");
    }

    /** 물어본 결과. 사용자가 어떻게 답했든 지금 상태를 다시 확인해서 알려 준다. */
    @PermissionCallback
    private void notifyResult(PluginCall call) {
        JSObject result = new JSObject();
        result.put("granted", notificationsEnabled());
        call.resolve(result);
    }

    private boolean notificationsEnabled() {
        NotificationManager manager = (NotificationManager) getContext()
            .getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return false;
        return manager.areNotificationsEnabled();
    }
}
