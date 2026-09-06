plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val synthsaraGatewayUrl = providers
    .gradleProperty("SYNTHSARA_MOBILE_GATEWAY_URL")
    .orElse("https://genesis-seven-bice.vercel.app/api/o-series/chat")
    .get()

android {
    namespace = "org.synthsara.nodezero.launcher"
    compileSdk = 35

    defaultConfig {
        applicationId = "org.synthsara.nodezero.launcher"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "SARAH_GATEWAY_URL", "\"$synthsaraGatewayUrl\"")
    }

    buildFeatures {
        buildConfig = true
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro",
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}
