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

    private File fileFromUri(Uri uri) {
        String name = uri.getLastPathSegment();
        if (name == null) return null;
        return new File(rootDir(), name);
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection, String[] selectionArgs, String sortOrder) {
        MatrixCursor cursor = new MatrixCursor(new String[] {
            OpenableColumns.DISPLAY_NAME,
            OpenableColumns.SIZE,
            "uri",
            "mime"
        });

        if (matcher.match(uri) == FILES) {
            File[] files = rootDir().listFiles();
            if (files != null) {
                for (File file : files) {
                    if (file.isFile()) {
                        String mime = GestionNativeStore.guessMime(file.getName());
                        Uri contentUri = Uri.parse("content://" + AUTHORITY + "/files/" + Uri.encode(file.getName()));
                        cursor.addRow(new Object[] { file.getName(), file.length(), contentUri.toString(), mime });
                    }
                }
            }
            return cursor;
        }

        if (matcher.match(uri) == FILE) {
            File file = fileFromUri(uri);
            if (file != null && file.exists()) {
                cursor.addRow(new Object[] { file.getName(), file.length(), uri.toString(), GestionNativeStore.guessMime(file.getName()) });
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
        if (file == null || !file.exists()) throw new FileNotFoundException("Fichier introuvable");
        return ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public Uri insert(Uri uri, ContentValues values) { return null; }
    @Override public int delete(Uri uri, String selection, String[] selectionArgs) { return 0; }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) { return 0; }
}
