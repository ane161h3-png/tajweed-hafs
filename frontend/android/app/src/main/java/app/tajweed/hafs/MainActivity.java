package app.tajweed.hafs;

import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** جسر الطباعة: يتيح لصفحة «دفتري» حفظ الصفحة الحالية ملف PDF عبر نافذة الطباعة في أندرويد. */
    private class PrintBridge {
        @JavascriptInterface
        public void print(final String title) {
            runOnUiThread(() -> {
                WebView web = getBridge().getWebView();
                PrintManager manager = (PrintManager) getSystemService(PRINT_SERVICE);
                if (web == null || manager == null) return;
                String job = (title == null || title.trim().isEmpty()) ? "دفتر التجويد" : title;
                PrintDocumentAdapter adapter = web.createPrintDocumentAdapter(job);
                manager.print(job, adapter, new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            });
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getBridge().getWebView().addJavascriptInterface(new PrintBridge(), "AndroidPrint");
    }
}
