package com.echoref.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/**
 * 心脏超声参考值 —— WebView 外壳
 *
 * 设计要点：
 *   1. 页面来自 assets/index.html，**页面本体离线**；视频库是 https 直链，需要 INTERNET 权限
 *   2. 适配刘海屏 / 手势导航（edge-to-edge + 系统栏透明）
 *   3. 禁用缩放与长按选择，让网页更接近原生 App 手感
 *   4. 拦截非本地链接，交给系统浏览器打开（本工程目前用不到，留作扩展）
 *   5. 返回键优先让 WebView 内的 history 回退
 */
public class MainActivity extends Activity {

    private WebView web;
    private FrameLayout root;

    /** 应用内页面地址 */
    private static final String HOME_URL = "file:///android_asset/index.html";

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ── 状态栏 / 导航栏：透明 + 浅色图标（页面顶栏是深蓝，用浅色字）──
        Window win = getWindow();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            win.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
            win.setStatusBarColor(Color.TRANSPARENT);
            win.setNavigationBarColor(Color.TRANSPARENT);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            // 页面顶栏为深蓝，状态栏文字用白色 → 清掉 LIGHT_STATUS_BAR
            win.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }

        // ── 用代码建 WebView，避免依赖 layout XML 资源 ──
        FrameLayout root = new FrameLayout(this);
        this.root = root;
        root.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        root.setFitsSystemWindows(false);

        web = new WebView(this);
        web.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web.setBackgroundColor(Color.parseColor("#f5f6f8"));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);          // 页面逻辑依赖 JS
        s.setDomStorageEnabled(true);          // localStorage 备用
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setSupportZoom(false);               // 关闭缩放，接近原生手感
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setSupportMultipleWindows(false);
        s.setGeolocationEnabled(false);
        s.setSaveFormData(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        // ★ v1.11.1：页内播放浮层靠 <video autoplay> 起播。Android 5.0 起 WebView 默认
        //   MediaPlaybackRequiresUserGesture=true，autoplay 会被静默拒绝 —— 表现就是
        //   画面渲染出来、时间停在 0:00、一直显示「仍在缓冲」。这里必须关掉。
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
            s.setMediaPlaybackRequiresUserGesture(false);
        }
        // 视频直链都是 https，页面是 file://，不涉及混合内容；设成允许只是为了以后
        // 万一有 http 素材不至于静默失败
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            s.setMixedContentMode(WebSettings.MIXED_CONTENT_COMPATIBILITY_MODE);
        }

        // ★ v1.10.4：UA 加后缀，网页据此把 .mp4 改成 App 内浮层播放（网页版仍是 target=_blank 外链）
        s.setUserAgentString(s.getUserAgentString() + " EchoRefApp");

        // 禁用文件跨域访问（安全），但允许 file:// 读取同目录资源
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            s.setAllowFileAccessFromFileURLs(true);
            s.setAllowUniversalAccessFromFileURLs(true);
        }

        // 长按不弹选择菜单，更像 App
        web.setLongClickable(false);
        web.setHapticFeedbackEnabled(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.HONEYCOMB) {
            web.setOnLongClickListener(new View.OnLongClickListener() {
                @Override
                public boolean onLongClick(View v) {
                    return true;   // 吞掉长按
                }
            });
        }

        // ★ v1.10.4：页内播放浮层的全屏按钮靠 WebChromeClient 接管，否则点了没反应
        web.setWebChromeClient(new WebChromeClient() {
            private View fullView;
            private WebChromeClient.CustomViewCallback fullCb;

            @Override
            public void onShowCustomView(View view, WebChromeClient.CustomViewCallback callback) {
                if (fullView != null) { callback.onCustomViewHidden(); return; }
                fullView = view;
                fullCb = callback;
                MainActivity.this.root.addView(view, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                web.setVisibility(View.GONE);
            }

            @Override
            public void onHideCustomView() {
                if (fullView == null) return;
                MainActivity.this.root.removeView(fullView);
                fullView = null;
                web.setVisibility(View.VISIBLE);
                if (fullCb != null) { fullCb.onCustomViewHidden(); fullCb = null; }
            }
        });

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    return handleUrl(req.getUrl().toString());
                }
                return false;
            }
        });

        root.addView(web);
        setContentView(root);

        if (savedInstanceState == null) {
            web.loadUrl(HOME_URL);
        } else {
            web.restoreState(savedInstanceState);
        }
    }

    /** 本地 http(s) 之外的链接交给系统处理 */
    private boolean handleUrl(String url) {
        if (url == null) return false;
        if (url.startsWith("file://") || url.startsWith("about:")) return false;

        // ★ v1.10.4：视频不再甩给系统播放器（跳出去要按返回键切回来），改成 App 内浮层播放。
        //   JS 的捕获阶段监听已经拦住常规点击，这里只是兜底（比如中键打开、JS 未就绪）。
        if (url.matches("(?i).*\\.mp4(\\?.*)?$")) {
            String js = "window.__openVideo && window.__openVideo('" +
                    url.replace("\\", "\\\\").replace("'", "\\'") + "')";
            web.evaluateJavascript(js, null);
            return true;
        }

        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
        } catch (Exception ignored) {
        }
        return true;
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK && web != null && web.canGoBack()) {
            web.goBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.loadUrl("about:blank");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
