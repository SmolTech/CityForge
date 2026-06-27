/* global require, module */

const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs/promises");
const path = require("path");

const GRADLE_VERSION = "9.3.1";

function withLatestGradle(config) {
  return withDangerousMod(config, [
    "android",
    async (expoConfig) => {
      const wrapperPath = path.join(
        expoConfig.modRequest.platformProjectRoot,
        "gradle",
        "wrapper",
        "gradle-wrapper.properties"
      );

      const contents = await fs.readFile(wrapperPath, "utf8");
      const nextContents = contents.replace(
        /distributionUrl=.*gradle-[^/]+-bin\.zip/,
        `distributionUrl=https\\://services.gradle.org/distributions/gradle-${GRADLE_VERSION}-bin.zip`
      );

      if (nextContents !== contents) {
        await fs.writeFile(wrapperPath, nextContents);
      }

      return expoConfig;
    },
  ]);
}

module.exports = withLatestGradle;
