param([ValidateSet('init','build','info')][string]$Action = 'build')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
# Use the isolated toolchain when available, otherwise respect the developer's SDK.
if (!$env:JAVA_HOME -and (Test-Path '.android-tools/java')) {
    $env:JAVA_HOME = (Get-ChildItem '.android-tools/java' -Directory | Select-Object -First 1).FullName
}
if (!$env:ANDROID_HOME -and (Test-Path '.android-tools/sdk')) {
    $env:ANDROID_HOME = (Resolve-Path '.android-tools/sdk').Path
}
if (!$env:JAVA_HOME -or !$env:ANDROID_HOME) {
    throw 'Falta configurar JAVA_HOME y ANDROID_HOME. Consultá ANDROID.md.'
}
if (!$env:NDK_HOME) { $env:NDK_HOME = Join-Path $env:ANDROID_HOME 'ndk/27.2.12479018' }
$env:Path = "$env:JAVA_HOME/bin;$env:ANDROID_HOME/platform-tools;$env:Path"
if ($Action -eq 'info') {
    & java -version
    & rustup target list --installed
    exit $LASTEXITCODE
}
if ($Action -eq 'init' -or !(Test-Path 'src-tauri/gen/android')) {
    & npm.cmd run tauri -- android init --ci --skip-targets-install
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo inicializar Android.' }
}
if ($Action -eq 'build') {
    $buildLog = Join-Path ([IO.Path]::GetTempPath()) 'timex-android-build.log'
    & npm.cmd run tauri -- android build --debug --apk --target aarch64 2>&1 | Tee-Object -FilePath $buildLog
    if ($LASTEXITCODE -ne 0) {
        # Tauri compiled successfully but Windows may deny the packaging symlink.
        # Only bypass that specific packaging step, never a compiler failure.
        $log = Get-Content -LiteralPath $buildLog -Raw
        if ($log -notmatch 'Creation symbolic link is not allowed' -or $log -notmatch 'Finished .dev. profile') {
            throw 'No se pudo compilar la APK. Revisá el error de Tauri.'
        }
        $library = 'src-tauri/target/aarch64-linux-android/debug/libintervalos_lib.so'
        $destination = 'src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a'
        New-Item -ItemType Directory -Force $destination | Out-Null
        Copy-Item -LiteralPath $library -Destination "$destination/libintervalos_lib.so" -Force
        $gradle = './src-tauri/gen/android/gradlew.bat'
        if (Test-Path '.android-tools/gradle/gradle-8.14.3/bin/gradle.bat') {
            $gradle = './.android-tools/gradle/gradle-8.14.3/bin/gradle.bat'
        }
        & $gradle -p src-tauri/gen/android assembleUniversalDebug -x rustBuildUniversalDebug --console=plain
        if ($LASTEXITCODE -ne 0) { throw 'Falló el empaquetado con Gradle.' }
    }
}
