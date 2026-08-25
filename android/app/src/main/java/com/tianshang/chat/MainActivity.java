package com.tianshang.chat;

import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onResume() {
    super.onResume();
    // FLAG_SECURE (AGENTS.md §7.6): block screenshots & recents-thumbnail capture.
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
  }
}
