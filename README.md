It's advised not to install this python package locally as it will break horusdemodlib and crcmod packages.

Rough build process for python lib (linux only)
```
docker run -it -v /Users/mwheeler/src/webhorus:/webhorus -v emsdk:/webhorus/emsdk python:3.12 /bin/sh
apt-get update
pip install pyodide-build
cd /webhorus
git clone https://github.com/emscripten-core/emsdk.git
cd emsdk
PYODIDE_EMSCRIPTEN_VERSION=$(pyodide config get emscripten_version)
./emsdk install ${PYODIDE_EMSCRIPTEN_VERSION}
./emsdk activate ${PYODIDE_EMSCRIPTEN_VERSION}
source emsdk_env.sh
pyodide build --outdir web/assets/
```

Web dev
```
yarn install
yarn dev
```

### TODO
- github actions upload to s3 (see point below about wasm mimetype)
- baud / frequency estimate
- snr max hold
- spectra view - waterfall might be nice if possible
- station position reports
- application/wasm needs to be set for s3://horus.sondehub.org/assets/node_modules/pyodide/pyodide.asm.wasm
