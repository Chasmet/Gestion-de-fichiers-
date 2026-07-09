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

    public static String safeFolderPath(String folderPath) {
        String clean = folderPath == null ? "Vrac" : folderPath.trim();
        clean = clean.replace("\\", "/");
        clean = clean.replace(" > ", "/");
        clean = clean.replaceAll("/+", "/");
        clean = clean.replaceAll("^/+|/+$", "");
        if (clean.isEmpty() || "Accueil".equalsIgnoreCase(clean)) clean = "Vrac";

        String[] parts = clean.split("/");
        StringBuilder builder = new StringBuilder();
        for (String part : parts) {
            String safe = safeName(part);
            if ("Accueil".equalsIgnoreCase(safe)) continue;
            if (builder.length() > 0) builder.append(File.separator);
            builder.append(safe);
        }

        return builder.length() > 0 ? builder.toString() : "Vrac";
    }

    public static String saveBase64(Context context, String name, String base64) {
        return saveBase64InFolder(context, "Vrac", name, base64);
    }

    public static String saveBase64InFolder(Context context, String folderPath, String name, String base64) {
        try {
            File root = rootDir(context);
            File dir = new File(root, safeFolderPath(folderPath));
            if (!dir.exists()) dir.mkdirs();

            File file = new File(dir, safeName(name));
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            try (FileOutputStream output = new FileOutputStream(file, false)) {
                output.write(bytes);
            }

            return relativePath(root, file);
        } catch (Exception error) {
            return "";
        }
    }

    public static String relativePath(File root, File file) {
        try {
            String rootPath = root.getCanonicalPath();
            String filePath = file.getCanonicalPath();
            if (!filePath.startsWith(rootPath)) return file.getName();
            String relative = filePath.substring(rootPath.length());
            relative = relative.replace(File.separatorChar, '/');
            return relative.replaceAll("^/+", "");
        } catch (Exception error) {
            return file.getName();
        }
    }

    public static String folderPathFromRelative(String relativePath) {
        if (relativePath == null || relativePath.trim().isEmpty()) return "Vrac";
        String clean = relativePath.replace("\\", "/");
        int index = clean.lastIndexOf('/');
        if (index <= 0) return "Vrac";
        return clean.substring(0, index);
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
