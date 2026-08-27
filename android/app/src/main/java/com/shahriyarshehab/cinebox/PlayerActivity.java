package com.shahriyarshehab.cinebox;

import android.app.Activity;
import android.app.PictureInPictureParams;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Rational;
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.OptIn;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.okhttp.OkHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;

@UnstableApi
public class PlayerActivity extends AppCompatActivity {

    public static final String EXTRA_STREAM_URL = "extra_stream_url";
    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_POSTER_URL = "extra_poster_url";
    public static final String EXTRA_POSITION_MS = "extra_position_ms";

    private PlayerView playerView;
    private ExoPlayer player;
    private ProgressBar bufferingProgress;
    private LinearLayout gestureHud;
    private TextView gestureIcon;
    private ProgressBar gestureProgress;
    private TextView gestureText;
    private LinearLayout seekIndicatorLeft;
    private LinearLayout seekIndicatorRight;

    private String streamUrl;
    private String mediaTitle;
    private long startPositionMs = 0;

    private AudioManager audioManager;
    private int maxVolume;
    private float currentBrightness = -1f;
    private GestureDetector gestureDetector;
    private final Handler hideHudHandler = new Handler(Looper.getMainLooper());
    private final Runnable hideHudRunnable = () -> {
        if (gestureHud != null) gestureHud.setVisibility(View.GONE);
        if (seekIndicatorLeft != null) seekIndicatorLeft.setVisibility(View.GONE);
        if (seekIndicatorRight != null) seekIndicatorRight.setVisibility(View.GONE);
    };

    private int currentResizeModeIdx = 0;
    private final int[] resizeModes = {
            AspectRatioFrameLayout.RESIZE_MODE_FIT,
            AspectRatioFrameLayout.RESIZE_MODE_ZOOM,
            AspectRatioFrameLayout.RESIZE_MODE_FILL,
            AspectRatioFrameLayout.RESIZE_MODE_FIXED_WIDTH
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setupImmersiveFullscreen();
        setContentView(R.layout.activity_player);

        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);

        streamUrl = getIntent().getStringExtra(EXTRA_STREAM_URL);
        mediaTitle = getIntent().getStringExtra(EXTRA_TITLE);
        if (mediaTitle == null || mediaTitle.isEmpty()) mediaTitle = "CineBox Stream";
        startPositionMs = getIntent().getLongExtra(EXTRA_POSITION_MS, 0);

        if (streamUrl == null || streamUrl.isEmpty()) {
            Toast.makeText(this, "Invalid stream URL", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        initViews();
        setupAudioAndBrightness();
        setupGestures();
        initExoPlayer();
    }

    private void setupImmersiveFullscreen() {
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars());
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }

    private void initViews() {
        playerView = findViewById(R.id.playerView);
        bufferingProgress = findViewById(R.id.bufferingProgress);
        gestureHud = findViewById(R.id.gestureHud);
        gestureIcon = findViewById(R.id.gestureIcon);
        gestureProgress = findViewById(R.id.gestureProgress);
        gestureText = findViewById(R.id.gestureText);
        seekIndicatorLeft = findViewById(R.id.seekIndicatorLeft);
        seekIndicatorRight = findViewById(R.id.seekIndicatorRight);
    }

    private void setupAudioAndBrightness() {
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (audioManager != null) {
            maxVolume = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        }
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        currentBrightness = lp.screenBrightness;
        if (currentBrightness < 0) currentBrightness = 0.5f;
    }

    private void initExoPlayer() {
        OkHttpClient okHttpClient = new OkHttpClient.Builder()
                .followRedirects(true)
                .followSslRedirects(true)
                .connectTimeout(15, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build();

        OkHttpDataSource.Factory okHttpDataSourceFactory = new OkHttpDataSource.Factory(okHttpClient)
                .setUserAgent("CineBoxNativePlayer/2.0 (Android)");

        DefaultDataSource.Factory dataSourceFactory = new DefaultDataSource.Factory(this, okHttpDataSourceFactory);

        DefaultMediaSourceFactory mediaSourceFactory = new DefaultMediaSourceFactory(this)
                .setDataSourceFactory(dataSourceFactory);

        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(mediaSourceFactory)
                .setSeekBackIncrementMs(10000)
                .setSeekForwardIncrementMs(10000)
                .build();

        playerView.setPlayer(player);

        MediaItem mediaItem = new MediaItem.Builder()
                .setUri(Uri.parse(streamUrl))
                .setMediaId(streamUrl)
                .build();

        player.setMediaItem(mediaItem);
        if (startPositionMs > 0) {
            player.seekTo(startPositionMs);
        }

        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_BUFFERING) {
                    bufferingProgress.setVisibility(View.VISIBLE);
                } else {
                    bufferingProgress.setVisibility(View.GONE);
                }
            }

            @Override
            public void onPlayerError(@NonNull PlaybackException error) {
                bufferingProgress.setVisibility(View.GONE);
                Toast.makeText(PlayerActivity.this, "Playback Error: " + error.getErrorCodeName(), Toast.LENGTH_LONG).show();
            }
        });

        player.prepare();
        player.setPlayWhenReady(true);
    }

    private void setupGestures() {
        gestureDetector = new GestureDetector(this, new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onDoubleTap(@NonNull MotionEvent e) {
                int screenWidth = getResources().getDisplayMetrics().widthPixels;
                if (e.getX() < screenWidth / 2f) {
                    // Rewind 10s
                    if (player != null) {
                        player.seekTo(Math.max(0, player.getCurrentPosition() - 10000));
                        showSeekIndicator(true);
                    }
                } else {
                    // Fast Forward 10s
                    if (player != null) {
                        player.seekTo(Math.min(player.getDuration(), player.getCurrentPosition() + 10000));
                        showSeekIndicator(false);
                    }
                }
                return true;
            }
        });

        playerView.setOnTouchListener(new View.OnTouchListener() {
            private float startY = 0;
            private float startX = 0;
            private boolean isVerticalScrolling = false;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                gestureDetector.onTouchEvent(event);

                int screenWidth = getResources().getDisplayMetrics().widthPixels;
                int screenHeight = getResources().getDisplayMetrics().heightPixels;

                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        startX = event.getX();
                        startY = event.getY();
                        isVerticalScrolling = false;
                        break;

                    case MotionEvent.ACTION_MOVE:
                        float deltaY = startY - event.getY();
                        float deltaX = event.getX() - startX;

                        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 20) {
                            isVerticalScrolling = true;
                            float percentChange = deltaY / (float) screenHeight;

                            if (startX < screenWidth / 2f) {
                                // Left side: Brightness
                                adjustBrightness(percentChange * 0.05f);
                            } else {
                                // Right side: Volume
                                adjustVolume(percentChange);
                            }
                            startY = event.getY();
                        }
                        break;

                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        if (isVerticalScrolling) {
                            hideHudHandler.postDelayed(hideHudRunnable, 1000);
                        }
                        break;
                }
                return false;
            }
        });
    }

    private void adjustVolume(float delta) {
        if (audioManager == null) return;
        int current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC);
        int step = delta > 0 ? 1 : -1;
        int target = Math.max(0, Math.min(maxVolume, current + step));
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0);

        int percent = (int) (((float) target / maxVolume) * 100);
        showGestureHud("🔊", percent, "Volume " + percent + "%");
    }

    private void adjustBrightness(float delta) {
        currentBrightness = Math.max(0.01f, Math.min(1.0f, currentBrightness + delta));
        WindowManager.LayoutParams lp = getWindow().getAttributes();
        lp.screenBrightness = currentBrightness;
        getWindow().setAttributes(lp);

        int percent = (int) (currentBrightness * 100);
        showGestureHud("☀️", percent, "Brightness " + percent + "%");
    }

    private void showGestureHud(String icon, int percent, String text) {
        hideHudHandler.removeCallbacks(hideHudRunnable);
        gestureIcon.setText(icon);
        gestureProgress.setProgress(percent);
        gestureText.setText(text);
        gestureHud.setVisibility(View.VISIBLE);
    }

    private void showSeekIndicator(boolean isLeft) {
        hideHudHandler.removeCallbacks(hideHudRunnable);
        if (isLeft) {
            seekIndicatorLeft.setVisibility(View.VISIBLE);
            seekIndicatorRight.setVisibility(View.GONE);
        } else {
            seekIndicatorRight.setVisibility(View.VISIBLE);
            seekIndicatorLeft.setVisibility(View.GONE);
        }
        hideHudHandler.postDelayed(hideHudRunnable, 650);
    }

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, @NonNull Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        if (isInPictureInPictureMode) {
            playerView.setUseController(false);
        } else {
            playerView.setUseController(true);
            setupImmersiveFullscreen();
        }
    }

    @Override
    public void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && player != null && player.isPlaying()) {
            try {
                PictureInPictureParams params = new PictureInPictureParams.Builder()
                        .setAspectRatio(new Rational(16, 9))
                        .build();
                enterPictureInPictureMode(params);
            } catch (Exception ignored) {}
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (player != null) {
            player.pause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        setupImmersiveFullscreen();
    }

    @Override
    protected void onDestroy() {
        if (player != null) {
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
