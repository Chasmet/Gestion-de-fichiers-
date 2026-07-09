package com.chasmet.gestiondefichiers;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.UriMatcher;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

public class GestionFilesProvider extends ContentProvider {
    public static final String AUTHORITY = "com.chasmet.gestiondefichiers.provider";
    private static final int FILES = 1;
    private static final int FILE = 2;

    private static final UriMatcher matcher = new UriMatcher(UriMatcher.NO_MATCH);

    static {
        matcher.addURI(AUTHORITY, "files", FILES);
        matcher.addURI(AUTHORITY, "files/*", FILE);
    }

    @Override
    public boolean onCreate() {
        return true;
    }

    private File rootDir() {
        File dir = new File(getContext().getFilesDir(), "gestionnaire_shared_files");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private File safeFileFromRelative(String relativePath) {
        if (relativePath == null || relativePath.trim().isEmpty()) return null;
        try {
            File root = rootDir();
            File file = new File(root, relativePath).getCanonicalFile();
            String rootPath = root.getCanonicalPath();
            if (!file.getPath().startsWith(rootPath)) return null;
            return file;
        } catch (Exception error) {
            return null;
        }
    }

    private File fileFromUri(Uri uri) {
        String relativePath = uri.getLastPathSegment();
        return safeFileFromRelative(relativePath);
    }

    private MatrixCursor makeCursor() {
        return new MatrixCursor(new String[] {
            OpenableColumns.DISPLAY_NAME,
            OpenableColumns.SIZE,
            "uri",
            "mime",
            "folderPath",
            "relativePath"
        });
    }

    private void addFileRows(MatrixCursor cursor, File root, File dir) {
        File[] files = dir.listFiles();
        if (files == null) return;

        for (File file : files) {
            if (file.isDirectory()) {
                addFileRows(cursor, root, file);
                continue;
            }

            if (!file.isFile()) continue;

            String relativePath = GestionNativeStore.relativePath(root, file);
            String folderPath = GestionNativeStore.folderPathFromRelative(relativePath);
            String mime = GestionNativeStore.guessMime(file.getName());
            Uri contentUri = Uri.parse("content://" + AUTHORITY + "/files/" + Uri.encode(relativePath));
            cursor.addRow(new Object[] {
                file.getName(),
                file.length(),
                contentUri.toString(),
                mime,
                folderPath,
                relativePath
            });
        }
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        MatrixCursor cursor = makeCursor();

        if (matcher.match(uri) == FILES) {
            File root = rootDir();
            addFileRows(cursor, root, root);
            return cursor;
        }

        if (matcher.match(uri) == FILE) {
            File file = fileFromUri(uri);
            if (file != null && file.exists() && file.isFile()) {
                String relativePath = GestionNativeStore.relativePath(rootDir(), file);
                cursor.addRow(new Object[] {
                    file.getName(),
                    file.length(),
                    uri.toString(),
                    GestionNativeStore.guessMime(file.getName()),
                    GestionNativeStore.folderPathFromRelative(relativePath),
                    relativePath
                });
            }
            return cursor;
        }

        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        File file = fileFromUri(uri);
        return GestionNativeStore.guessMime(file != null ? file.getName() : "");
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        File file = fileFromUri(uri);
        if (file == null || !file.exists() || !file.isFile()) throw new FileNotFoundException("Fichier introuvable");
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String selection, String[] selectionArgs) { return 0; }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { return 0; }
}
