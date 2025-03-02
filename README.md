It's advised not to install this python package locally as it will break horusdemodlib and crcmod packages.

Rough build process (linux only)
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
pyodide build --outdir web/
```


### TODO
- github actions builds
- include pyoxide in artefact
- js depend manager?
- baud / frequency estimate
- snr max hold
- refactor things around a bit
- spectra view - waterfall might be nice if possible
- upload enable / disable needs to be added
- station position reports
- map picker for location + geolocate if available