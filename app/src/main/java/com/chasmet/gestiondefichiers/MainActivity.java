package com.chasmet.gestiondefichiers;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.view.HapticFeedbackConstants;
import android.webkit.ConsoleMessage;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.InputStream;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST_CODE = 2001;
    private static final int FOLDER_IMPORT_REQUEST_CODE = 3001;
    private static final String ACTION_IMPORT_FOLDER = "com.chasmet.gestiondefichiers.IMPORT_FOLDER";
    private static final String[] DEFAULT_ACCEPT_TYPES = new String[] {
        "image/*",
        "video/*",
        "audio/*",
        "application/pdf",
        "text/*",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/zip",
        "application/x-zip-compressed"
    };

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        requestRuntimePermissions();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        webView.addJavascriptInterface(new NativeStoreBridge(), "GestionNativeStore");
        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }

            @Override
            public boolean onShowFileChooser(
                WebView webView,
                ValueCallback<Uri[]> filePathCallback,
                FileChooserParams fileChooserParams
            ) {
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }

                MainActivity.this.filePathCallback = filePathCallback;

                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("*/*");
                intent.putExtra(Intent.EXTRA_MIME_TYPES, cleanAcceptTypes(fileChooserParams.getAcceptTypes()));
                intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, fileChooserParams.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE);
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);

                Intent chooser = Intent.createChooser(intent, "Choisir une image, une vidéo, un audio ou un document");

                try {
                    nativeFeedback("soft");
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST_CODE);
                    return true;
                } catch (Exception error) {
                    MainActivity.this.filePathCallback = null;
                    Toast.makeText(MainActivity.this, "Sélecteur de fichiers indisponible", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                return true;
            }
        });

        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimeType);
                    request.addRequestHeader("User-Agent", userAgent);
                    request.setDescription("Téléchargement du fichier");
                    request.setTitle(URLUtil.guessFileName(url, contentDisposition, mimeType));
                    request.allowScanningByMediaScanner();
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, contentDisposition, mimeType));

                    DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                    if (manager != null) {
                        manager.enqueue(request);
                        Toast.makeText(MainActivity.this, "Téléchargement lancé", Toast.LENGTH_SHORT).show();
                        nativeFeedback("success");
                    }
                } catch (Exception error) {
                    Toast.makeText(MainActivity.this, "Téléchargement impossible", Toast.LENGTH_SHORT).show();
                    nativeFeedback("error");
                }
            }
        });

        webView.loadUrl("file:///android_asset/www/index.html");
        handleImportIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleImportIntent(intent);
    }

    private void handleImportIntent(Intent intent) {
        if (intent != null && ACTION_IMPORT_FOLDER.equals(intent.getAction())) {
            webView.postDelayed(() -> openAndroidFolderImporter(), 350);
        }
    }

    private void nativeFeedback(String kind) {
        if (webView == null) return;

        int feedback = HapticFeedbackConstants.KEYBOARD_TAP;
        if ("success".equals(kind)) feedback = HapticFeedbackConstants.CONFIRM;
        if ("error".equals(kind) || "danger".equals(kind)) feedback = HapticFeedbackConstants.REJECT;
        if ("long".equals(kind)) feedback = HapticFeedbackConstants.LONG_PRESS;

        try {
            webView.performHapticFeedback(feedback);
        } catch (Exception ignored) {}
    }

    public class NativeStoreBridge {
        @JavascriptInterface
        public String saveFileBase64(String name, String mimeType, String base64) {
            return GestionNativeStore.saveBase64(MainActivity.this, name, base64);
        }

        @JavascriptInterface
        public String saveFileBase64InFolder(String folderPath, String name, String mimeType, String base64) {
            return GestionNativeStore.saveBase64InFolder(MainActivity.this, folderPath, name, base64);
        }

        @JavascriptInterface
        public void openAndroidFolderImporter() {
            runOnUiThread(() -> MainActivity.this.openAndroidFolderImporter());
        }

        @JavascriptInterface
        public void haptic(String kind) {
            runOnUiThread(() -> nativeFeedback(kind));
        }

        @JavascriptInterface
        public void toast(String message) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show());
        }
    }

    private void openAndroidFolderImporter() {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);

        try {
            nativeFeedback("soft");
            startActivityForResult(intent, FOLDER_IMPORT_REQUEST_CODE);
        } catch (Exception error) {
            Toast.makeText(this, "Gestionnaire de fichiers indisponible", Toast.LENGTH_SHORT).show();
            nativeFeedback("error");
        }
    }

    private int importFolderTree(Uri treeUri, Intent data) {
        if (treeUri == null) return 0;

        try {
            int flags = data != null ? data.getFlags() : 0;
            int takeFlags = flags & (Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            if (takeFlags != 0) {
                getContentResolver().takePersistableUriPermission(treeUri, takeFlags);
            }
        } catch (Exception ignored) {}

        try {
            String treeDocumentId = DocumentsContract.getTreeDocumentId(treeUri);
            Uri rootDocumentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, treeDocumentId);
            String rootName = getDocumentDisplayName(rootDocumentUri, "Dossier importé");
            return copyDocumentTree(treeUri, treeDocumentId, rootName);
        } catch (Exception error) {
            return 0;
        }
    }

    private int copyDocumentTree(Uri treeUri, String documentId, String folderPath) {
        int copied = 0;
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, documentId);
        String[] projection = new String[] {
            DocumentsContract.Document.COLUMN_DOCUMENT_ID,
            DocumentsContract.Document.COLUMN_DISPLAY_NAME,
            DocumentsContract.Document.COLUMN_MIME_TYPE
        };

        try (Cursor cursor = getContentResolver().query(childrenUri, projection, null, null, null)) {
            if (cursor == null) return 0;

            int idIndex = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID);
            int nameIndex = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
            int mimeIndex = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE);

            while (cursor.moveToNext()) {
                String childId = idIndex >= 0 ? cursor.getString(idIndex) : "";
                String name = nameIndex >= 0 ? cursor.getString(nameIndex) : "fichier";
                String mime = mimeIndex >= 0 ? cursor.getString(mimeIndex) : "application/octet-stream";

                if (childId == null || childId.isEmpty()) continue;

                if (DocumentsContract.Document.MIME_TYPE_DIR.equals(mime)) {
                    copied += copyDocumentTree(treeUri, childId, folderPath + "/" + name);
                    continue;
                }

                Uri fileUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, childId);
                try (InputStream input = getContentResolver().openInputStream(fileUri)) {
                    if (input == null) continue;
                    String saved = GestionNativeStore.saveInputStreamInFolder(this, folderPath, name, input);
                    if (saved != null && !saved.isEmpty()) copied++;
                } catch (Exception ignored) {}
            }
        } catch (Exception ignored) {}

        return copied;
    }

    private String getDocumentDisplayName(Uri documentUri, String fallback) {
        try (Cursor cursor = getContentResolver().query(
            documentUri,
            new String[] { DocumentsContract.Document.COLUMN_DISPLAY_NAME },
            null,
            null,
            null
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
                if (index >= 0) {
                    String value = cursor.getString(index);
                    if (value != null && !value.trim().isEmpty()) return value.trim();
                }
            }
        } catch (Exception ignored) {}

        return fallback;
    }

    private String[] cleanAcceptTypes(String[] acceptTypes) {
        if (acceptTypes == null || acceptTypes.length == 0) {
            return DEFAULT_ACCEPT_TYPES;
        }

        int validCount = 0;
        for (String type : acceptTypes) {
            if (type != null && !type.trim().isEmpty() && !"*/*".equals(type.trim())) {
                validCount++;
            }
        }

        if (validCount == 0) {
            return DEFAULT_ACCEPT_TYPES;
        }

        String[] cleanedTypes = new String[validCount];
        int index = 0;
        for (String type : acceptTypes) {
            if (type != null && !type.trim().isEmpty() && !"*/*".equals(type.trim())) {
                cleanedTypes[index] = type.trim();
                index++;
            }
        }

        return cleanedTypes;
    }

    private void requestRuntimePermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(new String[] {
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO,
                Manifest.permission.READ_MEDIA_AUDIO
            }, 1001);
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            requestPermissions(new String[] {
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.READ_EXTERNAL_STORAGE
            }, 1001);
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FOLDER_IMPORT_REQUEST_CODE) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                nativeFeedback("soft");
                Toast.makeText(this, "Import du dossier en cours…", Toast.LENGTH_SHORT).show();
                int count = importFolderTree(data.getData(), data);
                Toast.makeText(
                    this,
                    count > 0 ? count + " fichier(s) importé(s) dans Gestionnaire" : "Aucun fichier importé",
                    Toast.LENGTH_LONG
                ).show();
                nativeFeedback(count > 0 ? "success" : "error");
                if (webView != null) {
                    webView.evaluateJavascript("window.dispatchEvent(new CustomEvent('gestion-native-folder-imported', { detail: { count: " + count + " } }))", null);
                }
            } else {
                nativeFeedback("error");
            }
            return;
        }

        if (requestCode != FILE_CHOOSER_REQUEST_CODE || filePathCallback == null) {
            return;
        }

        Uri[] results = null;

        if (resultCode == Activity.RESULT_OK && data != null) {
            if (data.getClipData() != null) {
                int count = data.getClipData().getItemCount();
                results = new Uri[count];
                for (int i = 0; i < count; i++) {
                    Uri uri = data.getClipData().getItemAt(i).getUri();
                    try {
                        getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    } catch (Exception ignored) {}
                    results[i] = uri;
                }
                nativeFeedback(count > 0 ? "success" : "error");
            } else if (data.getData() != null) {
                Uri uri = data.getData();
                try {
                    getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Exception ignored) {}
                results = new Uri[] { uri };
                nativeFeedback("success");
            }
        } else {
            nativeFeedback("error");
        }

        filePathCallback.onReceiveValue(results);
        filePathCallback = null;
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            nativeFeedback("soft");
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
