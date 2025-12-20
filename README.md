<div align="center">
    <br/>
    <p>
        <img src="apps/web/public/icon.svg"
            title="Bussitutka" alt="Bussitutka logo" width="100" />
        <h1>Bussitutka</h1>
    </p>
    <p width="120">
        A real-time bus tracker for the Föli region, built with modern web technologies, powered by webgl & LibreMap.
    </p>
    <a href="https://bussit.juh.fi/">
        bussit.juh.fi
    </a>
		<br />
		<a href="https://juh.fi/blog/bussit-kartalla/">
        Revamping Föli's Bus Tracker for the modern web (juh.fi)
    </a>
</div>
<br/>

## Development
This monorepo consists of two main apps: the web client and the server.

The web client is a React (Vite) app. Relevant components are tailwind, zustand, nuqs, react-map-gl (maplibre). Most components rely on shadcn/ui. The build can be served statically, and is done so via the server app in production.

The server is an Elysia app. It functions as a pretty basic proxy for the Föli
real-time API.

Preview must be used to run the app locally. I'll fix the dev environment at some point.

```sh
bun install
bun preview
```

### Frontend formatting
bussit.juh.fi uses Biome. 
```sh
biome lint --fix ./src
biome check --fix ./src
biome format --fix ./src
```