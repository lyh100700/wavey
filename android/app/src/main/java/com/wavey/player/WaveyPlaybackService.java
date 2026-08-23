package com.wavey.player;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.MediaMetadata;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Base64;

import androidx.annotation.Nullable;

/**
 * 앱을 벗어나도 음악이 계속 나오게 하고, 상단·잠금화면에 재생 카드를 띄운다.
 *
 * ── 왜 직접 만들었나 ──
 *
 * 예전에는 남이 만든 플러그인(capacitor-android-foreground-service)을 썼는데,
 * 알림을 "갱신"하는 길이 안드로이드와의 약속을 어기고 있었다.
 * startForegroundService()를 부르면 "5초 안에 startForeground()를 부르겠다"는
 * 약속이 성립하는데, 갱신 경로는 알림만 다시 그리고 그 약속을 지키지 않았다.
 * 약속을 어기면 시스템이 앱을 죽인다. 그래서 곡이 바뀌어도 알림을 건드리지
 * 못했고, 제목이 옛 곡 그대로 남아 있었다.
 *
 * 여기서는 그 문제가 아예 생기지 않는다. 서비스가 이미 떠 있으면 인텐트를
 * 다시 보내지 않고, 서비스 자신이 자기 알림만 조용히 갈아끼운다(render).
 * 이미 포그라운드로 올라간 서비스가 자기 알림을 바꾸는 것은 안드로이드가
 * 완전히 허용하는 일이라, 앱이 뒤에 있어도 제목이 바로 바뀐다.
 *
 * ── 세 가지를 반드시 지킨다 ──
 *
 * 1) 재우지 않기(wake lock)
 *    화면이 꺼지면 안드로이드는 CPU까지 재운다. 그러면 소리가 뚝 끊긴다.
 *    예전 플러그인이 몰래 해 주던 일이라 놓치기 쉬운데, 이게 빠지면
 *    "알림은 예쁜데 몇 분 뒤 소리가 멈추는" 증상이 난다.
 *
 * 2) 미디어 세션(MediaSession)
 *    "제가 지금 음악 앱입니다"라고 안드로이드에 등록하는 표찰이다.
 *    이게 있어야 잠금화면 재생 카드, 빠른설정의 미디어 칸, 블루투스
 *    이어폰 버튼이 동작한다. 안드로이드 14부터는 mediaPlayback 종류의
 *    서비스를 띄울 때 이게 없으면 거부당하기도 한다.
 *
 * 3) 알림 채널 이름은 예전 그대로(wavey-playback)
 *    채널은 한 번 만들면 설정을 바꿀 수 없다. 새 이름을 쓰면 사용자 폰의
 *    알림 설정에 쓰지 않는 항목이 하나 더 남는다.
 */
public class WaveyPlaybackService extends Service {

    /** 알림·잠금화면에서 누른 버튼을 웹 화면으로 전해 주는 통로. */
    public interface Listener {
        void onAction(String action, long positionMs);
    }

    /* ── 주고받는 말 ──────────────────────────────────────── */

    static final String ACTION_SHOW = "com.wavey.player.SHOW";
    static final String ACTION_PLAY = "play";
    static final String ACTION_PAUSE = "pause";
    static final String ACTION_TOGGLE = "toggle";
    static final String ACTION_NEXT = "next";
    static final String ACTION_PREV = "prev";
    static final String ACTION_SEEK = "seek";

    static final String CHANNEL_ID = "wavey-playback";
    private static final int NOTIFICATION_ID = 1;

    // 조용히 뜨되 상태바에는 남는 세기. 곡이 바뀔 때마다 소리가 나면 안 된다.
    private static final int IMPORTANCE_LOW = NotificationManager.IMPORTANCE_LOW;

    /** 지금 무엇을 틀고 있는지. */
    public static class NowPlaying {
        public String title = "";
        public String artist = "";
        public String album = "";
        public boolean playing = false;
        public long positionMs = 0;
        public long durationMs = 0;
        /** 앨범 그림. 같은 곡이면 다시 보내지 않으므로 보통은 비어 있다. */
        @Nullable
        public String artwork = null;
        /** 그림의 이름표(곡 id). 같은 이름표면 이미 그려 둔 그림을 다시 쓴다. */
        @Nullable
        public String artworkKey = null;
    }

    /*
     * 서비스와 플러그인은 같은 앱 안(같은 프로세스)에서 돌기 때문에, 값을
     * 인텐트에 실어 보내지 않고 이렇게 바로 나눠 볼 수 있다. 훨씬 빠르고,
     * 무엇보다 인텐트를 다시 보내지 않으니 위에서 말한 "약속"이 생기지 않는다.
     */
    @Nullable
    private static WaveyPlaybackService instance;

    @Nullable
    private static NowPlaying latest;

    @Nullable
    private static Listener listener;

    /* ── 바깥(플러그인)에서 부르는 창구 ───────────────────── */

    /** 버튼 눌림을 받아 갈 곳을 등록한다. 앱이 끝나면 null로 지운다. */
    static void setListener(@Nullable Listener value) {
        listener = value;
    }

    /**
     * 재생 카드를 띄우거나 내용을 갈아끼운다.
     *
     * 처음 한 번만 서비스를 시작하고, 그 뒤로는 서비스가 자기 알림을 직접
     * 고친다. 그래서 앱이 뒤에 있어도 곡 제목이 바로 따라온다.
     */
    static void show(Context context, NowPlaying info) {
        latest = info;

        WaveyPlaybackService running = instance;
        if (running != null) {
            running.render(false);
            return;
        }

        // 아직 서비스가 없을 때만 새로 띄운다.
        // 안드로이드 12부터 이 시작은 앱이 화면에 보일 때만 허용된다.
        Intent intent = new Intent(context, WaveyPlaybackService.class).setAction(ACTION_SHOW);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    /** 재생 카드를 치운다. 틀 것이 없어졌거나 앱이 끝날 때. */
    static void hide() {
        latest = null;
        WaveyPlaybackService running = instance;
        if (running != null) running.shutdown();
    }

    /** 알림 채널을 만들어 둔다. 여러 번 불러도 문제없다. */
    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "재생 중", IMPORTANCE_LOW);
        channel.setDescription("Wavey가 재생 중일 때 상단에 남는 알림이에요");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    /* ── 서비스의 한살이 ──────────────────────────────────── */

    @Nullable
    private MediaSession session;

    @Nullable
    private PowerManager.WakeLock wakeLock;

    // 같은 그림을 곡마다 다시 그리지 않기 위한 보관함
    @Nullable
    private Bitmap artBitmap;

    @Nullable
    private String artKey;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        ensureChannel(this);

        session = new MediaSession(this, "Wavey");
        // 안드로이드 8 미만에서는 이 표시가 있어야 버튼이 이쪽으로 온다.
        // 그 이상에서는 늘 켜져 있어서 적어도 그만이다.
        session.setFlags(
            MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS
        );
        session.setCallback(
            new MediaSession.Callback() {
                @Override
                public void onPlay() {
                    dispatch(ACTION_PLAY, 0);
                }

                @Override
                public void onPause() {
                    dispatch(ACTION_PAUSE, 0);
                }

                @Override
                public void onSkipToNext() {
                    dispatch(ACTION_NEXT, 0);
                }

                @Override
                public void onSkipToPrevious() {
                    dispatch(ACTION_PREV, 0);
                }

                @Override
                public void onStop() {
                    dispatch(ACTION_PAUSE, 0);
                }

                @Override
                public void onSeekTo(long pos) {
                    dispatch(ACTION_SEEK, pos);
                }
            }
        );
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();

        if (ACTION_SHOW.equals(action) || action == null) {
            /*
             * startForegroundService()로 불려 왔을 수 있으므로, 무슨 일이 있어도
             * 여기서 startForeground()를 부르고 나간다. 이게 그 "약속"이다.
             * 틀 것이 없으면 약속만 지키고 곧바로 접는다.
             */
            render(true);
            if (latest == null) shutdown();
        } else {
            // 알림 버튼을 누른 경우. 이미 포그라운드로 떠 있는 상태라
            // 새로 startForeground()를 부를 필요가 없다.
            dispatch(action, 0);
        }

        // 시스템이 메모리가 모자라 서비스를 죽였다면 되살리지 않는다.
        // 그때는 소리도 이미 끊긴 뒤라, 빈 알림만 되살아나면 더 이상하다.
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        if (session != null) {
            session.setActive(false);
            session.release();
            session = null;
        }
        if (instance == this) instance = null;
        super.onDestroy();
    }

    private void shutdown() {
        stopForeground(Service.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void dispatch(String action, long positionMs) {
        Listener target = listener;
        if (target != null) target.onAction(action, positionMs);
    }

    /* ── 알림 그리기 ──────────────────────────────────────── */

    /**
     * 지금 상태로 재생 카드를 다시 그린다.
     *
     * @param asForeground 서비스를 처음 띄우는 길이면 true.
     *                     그 뒤의 갱신은 false — 알림만 조용히 바꾼다.
     */
    private void render(boolean asForeground) {
        NowPlaying info = latest;
        if (info == null) {
            // 틀 것이 없는데 약속만 지켜야 하는 아주 짧은 순간.
            info = new NowPlaying();
            info.title = "Wavey";
        }

        updateSession(info);
        Notification notification = build(info);

        if (asForeground) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } else {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) manager.notify(NOTIFICATION_ID, notification);
        }

        // 소리가 날 때만 CPU를 붙잡는다. 멈춰 있을 때까지 붙잡으면 배터리만 닳는다.
        if (info.playing) acquireWakeLock();
        else releaseWakeLock();
    }

    private Notification build(NowPlaying info) {
        Notification.Builder builder = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? new Notification.Builder(this, CHANNEL_ID)
            : new Notification.Builder(this);

        builder
            .setContentTitle(info.title)
            .setContentText(subtitle(info))
            .setSmallIcon(smallIcon())
            .setLargeIcon(artwork(info))
            .setContentIntent(openAppIntent())
            .setColor(getColor(R.color.colorPrimaryDark))
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setShowWhen(false)
            // 재생 중에는 못 지우게 한다. 멈춘 뒤에는 밀어서 치울 수 있다.
            .setOngoing(info.playing)
            // 곡이 바뀔 때마다 소리·진동이 나지 않게 한다.
            .setOnlyAlertOnce(true);

        builder.addAction(action(R.drawable.ic_media_prev, "이전", ACTION_PREV));
        builder.addAction(
            info.playing
                ? action(R.drawable.ic_media_pause, "일시정지", ACTION_TOGGLE)
                : action(R.drawable.ic_media_play, "재생", ACTION_TOGGLE)
        );
        builder.addAction(action(R.drawable.ic_media_next, "다음", ACTION_NEXT));

        /*
         * 이 한 줄이 "음악 앱 알림"과 "그냥 알림"을 가른다.
         * MediaStyle을 입히고 세션 표찰을 달아 줘야 상단 미디어 카드에 들어가고,
         * 접혀 있을 때도 버튼 세 개가 그대로 보인다.
         */
        Notification.MediaStyle style = new Notification.MediaStyle().setShowActionsInCompactView(0, 1, 2);
        if (session != null) style.setMediaSession(session.getSessionToken());
        builder.setStyle(style);

        return builder.build();
    }

    private String subtitle(NowPlaying info) {
        boolean hasArtist = info.artist != null && !info.artist.isEmpty();
        boolean hasAlbum = info.album != null && !info.album.isEmpty();
        if (hasArtist && hasAlbum) return info.artist + " · " + info.album;
        if (hasArtist) return info.artist;
        if (hasAlbum) return info.album;
        return "";
    }

    private Notification.Action action(int icon, String title, String action) {
        Intent intent = new Intent(this, WaveyPlaybackService.class).setAction(action);
        PendingIntent pending = PendingIntent.getService(
            this,
            action.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        return new Notification.Action.Builder(android.graphics.drawable.Icon.createWithResource(this, icon), title, pending)
            .build();
    }

    /** 알림을 누르면 앱이 열리도록. */
    @Nullable
    private PendingIntent openAppIntent() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch == null) return null;
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        return PendingIntent.getActivity(
            this,
            0,
            launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private int smallIcon() {
        int id = getResources().getIdentifier("ic_stat_wavey", "drawable", getPackageName());
        return id != 0 ? id : android.R.drawable.ic_media_play;
    }

    /* ── 미디어 세션 ──────────────────────────────────────── */

    private void updateSession(NowPlaying info) {
        MediaSession target = session;
        if (target == null) return;

        MediaMetadata.Builder meta = new MediaMetadata.Builder()
            .putString(MediaMetadata.METADATA_KEY_TITLE, info.title)
            .putString(MediaMetadata.METADATA_KEY_ARTIST, info.artist == null ? "" : info.artist)
            .putString(MediaMetadata.METADATA_KEY_ALBUM, info.album == null ? "" : info.album)
            .putLong(MediaMetadata.METADATA_KEY_DURATION, info.durationMs);

        Bitmap art = artwork(info);
        if (art != null) meta.putBitmap(MediaMetadata.METADATA_KEY_ALBUM_ART, art);
        target.setMetadata(meta.build());

        /*
         * 재생 속도를 1로 알려 주면, 위치를 매초 보내지 않아도 안드로이드가
         * 알아서 시계를 굴려 준다. 그래서 잠금화면 막대가 부드럽게 움직인다.
         * 멈췄을 때는 0으로 줘서 막대도 함께 멈춘다.
         */
        PlaybackState state = new PlaybackState.Builder()
            .setActions(
                PlaybackState.ACTION_PLAY |
                PlaybackState.ACTION_PAUSE |
                PlaybackState.ACTION_PLAY_PAUSE |
                PlaybackState.ACTION_SKIP_TO_NEXT |
                PlaybackState.ACTION_SKIP_TO_PREVIOUS |
                PlaybackState.ACTION_SEEK_TO |
                PlaybackState.ACTION_STOP
            )
            .setState(
                info.playing ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                info.positionMs,
                info.playing ? 1f : 0f
            )
            .build();
        target.setPlaybackState(state);

        if (!target.isActive()) target.setActive(true);
    }

    /* ── 앨범 그림 ────────────────────────────────────────── */

    /**
     * 웹에서 그려 보낸 그림을 비트맵으로 바꾼다.
     *
     * 같은 곡이면 웹이 그림을 다시 보내지 않는다(글자로 바꾸면 꽤 큰 값이라
     * 매번 주고받으면 느려진다). 그럴 때는 이름표를 보고 지난번 것을 다시 쓴다.
     */
    @Nullable
    private Bitmap artwork(NowPlaying info) {
        boolean sameAsCached = info.artworkKey != null && info.artworkKey.equals(artKey);
        if (sameAsCached && artBitmap != null) return artBitmap;

        if (info.artwork == null || info.artwork.isEmpty()) {
            return sameAsCached ? artBitmap : null;
        }

        try {
            String raw = info.artwork;
            int comma = raw.indexOf(',');
            // "data:image/png;base64,...." 꼴로 올 수 있다. 쉼표 뒤가 알맹이다.
            if (raw.startsWith("data:") && comma > 0) raw = raw.substring(comma + 1);
            byte[] bytes = Base64.decode(raw, Base64.DEFAULT);
            artBitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            artKey = info.artworkKey;
        } catch (Exception e) {
            // 그림이 없어도 재생에는 아무 지장이 없다.
            artBitmap = null;
            artKey = null;
        }
        return artBitmap;
    }

    /* ── 재우지 않기 ──────────────────────────────────────── */

    /**
     * 화면이 꺼져도 CPU는 깨어 있게 붙잡아 둔다.
     *
     * 이것이 빠지면 알림은 멀쩡한데 몇 분 뒤 소리만 뚝 끊긴다.
     * 예전 플러그인이 대신 해 주던 일이라 특히 잊기 쉬운 부분이다.
     */
    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) return;
        PowerManager power = getSystemService(PowerManager.class);
        if (power == null) return;
        PowerManager.WakeLock lock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Wavey::Playback");
        lock.setReferenceCounted(false);
        lock.acquire();
        wakeLock = lock;
    }

    private void releaseWakeLock() {
        if (wakeLock == null) return;
        if (wakeLock.isHeld()) wakeLock.release();
        wakeLock = null;
    }
}
