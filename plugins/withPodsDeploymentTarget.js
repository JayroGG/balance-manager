// Expo config plugin: raises every CocoaPods target's IPHONEOS_DEPLOYMENT_TARGET below 15.0 up to
// 15.0 on every `expo prebuild`. Some pods (e.g. RNCAsyncStorage 2.2.0 → 13.4) declare targets older
// than Xcode 27's minimum, which fails with "IPHONEOS_DEPLOYMENT_TARGET is set to 13.4". `ios/` is
// gitignored and regenerated, so the fix lives here instead of in the Podfile.
const { withPodfile } = require('@expo/config-plugins');

const MIN_IOS = '15.0';
const TAG = 'withPodsDeploymentTarget';

const BLOCK = `    # @generated begin ${TAG} - expo prebuild (DO NOT MODIFY)
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |c|
        if c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${MIN_IOS}
          c.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
        end
      end
    end
    # @generated end ${TAG}
`;

// Insert the loop at the end of the top-level post_install block (its `end` is the first line
// indented exactly two spaces after the opening — nested blocks are indented deeper).
function applyDeploymentTarget(contents) {
  if (contents.includes(`@generated begin ${TAG}`)) return contents; // already wired
  const re = /(post_install do \|installer\|\n[\s\S]*?\n)(  end\n)/;
  if (!re.test(contents)) {
    throw new Error('[withPodsDeploymentTarget] post_install block not found — Podfile template changed?');
  }
  return contents.replace(re, (_, head, end) => `${head}${BLOCK}${end}`);
}

module.exports = function withPodsDeploymentTarget(config) {
  return withPodfile(config, (cfg) => {
    cfg.modResults.contents = applyDeploymentTarget(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.applyDeploymentTarget = applyDeploymentTarget;
