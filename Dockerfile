FROM python:3.12
RUN apt-get update
RUN pip install pyodide-build
COPY ./ /webhorus
WORKDIR /webhorus
RUN git clone https://github.com/emscripten-core/emsdk.git
WORKDIR /webhorus/emsdk
RUN bash -c 'PYODIDE_EMSCRIPTEN_VERSION=$(pyodide config get emscripten_version) && \
./emsdk install ${PYODIDE_EMSCRIPTEN_VERSION} && \
./emsdk activate ${PYODIDE_EMSCRIPTEN_VERSION} && \
source emsdk_env.sh && cd .. && \
pyodide build --outdir web/'