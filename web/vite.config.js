import { dirname, join, resolve } from "path";
import { defineConfig } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { fileURLToPath } from "url";

const PYODIDE_EXCLUDE = [
    "!**/*.{md,html}",
    "!**/*.d.ts",
    "!**/*.whl",
    "!**/node_modules",
];

export function viteStaticCopyPyodide() {
    const pyodideDir = dirname(fileURLToPath(import.meta.resolve("pyodide")));
    return viteStaticCopy({
        targets: [
            {
                src: [join(pyodideDir, "*")].concat(PYODIDE_EXCLUDE),
                dest: "assets/node_modules/pyodide",
            },
        ],
    });
}

export default defineConfig({
    define: {
        globalThis: 'window'
    },
    root: resolve(__dirname, 'src'),
    resolve: {
        alias: {
            '~bootstrap': resolve(__dirname, 'node_modules/bootstrap'),
        }
    },
    css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler', // or "modern"
                silenceDeprecations: ['mixed-decls', 'color-functions', 'global-builtin', 'import']
            }
        }
    },

    build: {
        minify: false,
        rollupOptions: {
            treeshake: false,
            output: {
                //'inlineDynamicImports': false,
                'preserveModules': true,
                'preserveModulesRoot': 'src',

            },
            preserveEntrySignatures: true
        }
    },
    optimizeDeps: { exclude: ["pyodide", "loadPyodide"], noDiscovery: true },
    plugins: [viteStaticCopyPyodide(), viteStaticCopy(
        {
            targets: [
                {
                    src: 'modules/*',
                    dest: "assets",
                },
            ],
        }), viteStaticCopy(
            {
                targets: [
                    {
                        src: '../*.whl',
                        dest: "assets",
                    },
                ],
            }),
        , viteStaticCopy(
            {
                targets: [
                    {
                        src: 'js/audio.js',
                        dest: "assets/js",
                    },
                ],
            })
    ]
})