It's advised not to install this python package locally as it will break horusdemodlib and crcmod packages.

Build process (docker)
```
docker buildx build  --output ./web/src/public/assets .
```

Web dev
```
yarn install
yarn dev
```

### Fancy wizard links
Some example links are provided in web/src/public/examplelink.html


                    x: [globalThis.filtered_x_values],
                    y: [globalThis.wfY],
                    z: [globalThis.wfZ],