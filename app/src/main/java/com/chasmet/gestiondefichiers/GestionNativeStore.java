package com.chasmet.gestiondefichiers;

import android.content.Context;
import android.util.Base64;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileOutputStream;
import java.util.Locale;

public class GestionNativeStore {
    public static File rootDir(Context context) {
        File dir = new File(context.getFilesDir(), "gestionnaire_shared_files");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    public static String safeName(String name) {
        String clean = name == null ? "fichier" : name.trim();
        clean = clean.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (clean.isEmpty()) clean = "fichier";
        return clean;
    }

    public static String saveBase64(Context context, String name, String base64) {
        try {
            File dir = rootDir(context);
            File file = new File(dir, safeName(name));
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            try (FileOutputStream output = new FileOutputStream(file, false)) {
                output.write(bytes);
            }
            return file.getName();
        } catch (Exception error) {
            return "";
        }
    }

    public static String guessMime(String filename) {
        String ext = "";
        int dot = filename == null ? -1 : filename.lastIndexOf('.');
        if (dot >= 0 && dot < filename.length() - 1) {
            ext = filename.substring(dot + 1).toLowerCase(Locale.ROOT);
        }
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
        return mime != null ? mime : "application/octet-stream";
    }
}
