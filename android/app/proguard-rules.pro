-keepattributes *Annotation*
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-dontwarn com.google.androidbrowserhelper.**
-keep class com.google.androidbrowserhelper.** { *; }
