# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified in
# /usr/local/lib/android-sdk/tools/proguard/proguard-android.txt

# keep Capacitor
-keep class com.getcapacitor.** { *; }
-keep class com.novaedit.lite.** { *; }

# keep plugin classes
-keep class com.capacitorjs.plugins.** { *; }

# WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable

# Serialization
-keep class * implements java.io.Serializable { *; }
