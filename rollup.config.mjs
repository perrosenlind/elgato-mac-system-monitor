import commonjs from "@rollup/plugin-commonjs";
import resolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "com.perrosenlind.sysmon.sdPlugin";

export default {
  input: "src/plugin.ts",
  output: {
    file: `${sdPlugin}/bin/plugin.js`,
    format: "es",
    sourcemap: true,
    sourcemapPathTransform: (relativeSourcePath) =>
      relativeSourcePath.replace(/^\.\.\//, ""),
  },
  plugins: [
    typescript({
      mapRoot: isWatching ? "./" : undefined,
    }),
    resolve({ preferBuiltins: true }),
    commonjs(),
  ],
  external: ["@napi-rs/canvas", "systeminformation"],
};
