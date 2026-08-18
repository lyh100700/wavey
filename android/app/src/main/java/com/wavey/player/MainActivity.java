package com.wavey.player;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // 직접 만든 기능들을 웹 화면에서 부를 수 있도록 등록한다.
        // super.onCreate()보다 먼저 해야 웹이 뜨는 시점에 이미 준비돼 있다.
        registerPlugin(WaveyRingtonePlugin.class);
        registerPlugin(WaveyUpdaterPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
