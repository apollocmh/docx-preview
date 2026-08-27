import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import { getBabelOutputPlugin } from '@rollup/plugin-babel';

// UMD artifacts target legacy embedders (Chrome 76 / Firefox 78 / Safari 13 /
// Edge 79), which predate ES2020 operators. Babel runs as an OUTPUT plugin so
// it only downlevels the generated UMD chunk; the .mjs artifacts keep their
// original ES2020 syntax. Syntax-only: no core-js polyfills.
const umdDownlevel = () =>
	getBabelOutputPlugin({
		// Required: the plugin refuses non-es/cjs output formats otherwise.
		// Safe because `modules: false` keeps the UMD wrapper intact.
		allowAllFormats: true,
		babelrc: false,
		configFile: false,
		presets: [
			[
				'@babel/preset-env',
				{
					targets: {
						chrome: '76',
						firefox: '78',
						safari: '13',
						edge: '79',
					},
					modules: false,
				},
			],
		],
	});

const output = {
	banner: `/*
 * @license
 * docx-preview <https://github.com/VolodymyrBaydalka/docxjs>
 * Released under Apache License 2.0  <https://github.com/VolodymyrBaydalka/docxjs/blob/master/LICENSE>
 * Copyright Volodymyr Baydalka
 */`,
	sourcemap: true,
}

const umdOutput = {
	...output,
	name: "docx",
	file: 'dist/docx-preview.js',
	format: 'umd',
	globals: {
		jszip: 'JSZip'
	},
	plugins: [umdDownlevel()],
};

export default args => {
	const config = {
		input: 'src/docx-preview.ts',
		output: [umdOutput],
		plugins: [typescript()]
	}

	if (args.environment == 'BUILD:production')
		config.output = [umdOutput,
			{
				...umdOutput,
				file: 'dist/docx-preview.min.js',
				// Babel first, terser last: the downleveled input guarantees the
				// minifier cannot reintroduce ES2020 syntax into the UMD artifact.
				plugins: [umdDownlevel(), terser()]
			},
			{
				...output,
				file: 'dist/docx-preview.mjs',
				format: 'es',
			},
			{
				...output,
				file: 'dist/docx-preview.min.mjs',
				format: 'es',
				plugins: [terser()]
			}];

	return config
};