const { withMainApplication } = require('@expo/config-plugins');

const MARKER = '// withSoLoaderInit-applied';

// SoLoader must be initialised before DefaultNewArchitectureEntryPoint.load()
// is called, otherwise ReactNativeFeatureFlagsCxxInterop's static initialiser
// calls SoLoader.loadLibrary before the context is set up, throwing:
//   IllegalStateException: SoLoader.init() not yet called
//
// The Expo-generated MainApplication.kt omits this call; this plugin adds it.
module.exports = function withSoLoaderInit(config) {
  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;

    if (contents.includes(MARKER)) {
      console.log('[withSoLoaderInit] Already patched, skipping.');
      return config;
    }

    // Add SoLoader + merged-SO-mapping imports after the DefaultReactNativeHost import line
    if (!contents.includes('import com.facebook.soloader.SoLoader')) {
      contents = contents.replace(
        'import com.facebook.react.defaults.DefaultReactNativeHost',
        'import com.facebook.react.defaults.DefaultReactNativeHost\nimport com.facebook.react.soloader.OpenSourceMergedSoMapping\nimport com.facebook.soloader.SoLoader'
      );
    }

    // Add SoLoader.init() and the marker as the first line inside onCreate().
    // RN 0.76+ packs all native libs into a single libreactnative.so; SoLoader
    // must be initialised with OpenSourceMergedSoMapping so requests for merged
    // names (e.g. react_featureflagsjni) resolve into libreactnative.so. Using
    // the boolean overload registers no mapping and crashes with
    // SoLoaderDSONotFoundError: couldn't find DSO to load: libreact_featureflagsjni.so
    contents = contents.replace(
      /override fun onCreate\(\) \{\s*\n(\s*)super\.onCreate\(\)/,
      (match, indent) =>
        `override fun onCreate() {\n${indent}super.onCreate()\n${indent}${MARKER}\n${indent}SoLoader.init(this, OpenSourceMergedSoMapping)`
    );

    config.modResults.contents = contents;
    console.log('[withSoLoaderInit] Patched MainApplication.kt: added SoLoader.init().');
    return config;
  });
};
