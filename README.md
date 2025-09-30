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
. ./emsdk_env.sh
pyodide build --outdir web/assets/
```

Web dev
```
yarn install
yarn dev
```

### Fancy wizard links
Some example links are provided in web/src/public/examplelink.html
