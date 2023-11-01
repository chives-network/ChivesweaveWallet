<template>
	<vue3dLoader
	:showFps="false"
	:cameraPosition="{ x: 1, y: -5, z: -100 }"
	:filePath="src"
	:lights="lights"
	:crossOrigin="anonymous"
	:backgroundAlpha="0"
	class="img"
	></vue3dLoader>
</template>

<script lang="ts" setup>
import { vue3dLoader } from "vue-3d-loader";

const props = defineProps(['src'])
const lights = [
  {
    type: "AmbientLight",
    color: "black",
  },
  {
    type: "DirectionalLight",
    position: { x: 100, y: 10, z: 100 },
    color: "black",
    intensity: 0.5,
  },
  {
    type: "PointLight",
    color: "#000000",
    position: { x: 200, y: -200, z: 100 },
    intensity: 1
  },
  {
    type: "HemisphereLight",
    skyColor: "#00FF00",
    groundColor: "#000000",
    position: { x: 200, y: -200, z: 100 }
  }
]
</script>



<style scoped>
.img {
	width: 100%;
	min-width: 0;
	flex: 1 1 0;
	height: var(--current-vh);
}

.verticalContent .img {
	height: auto;
	width: 100%;
}

.verticalContent img {
	height: auto;
	width: 100%;
}

img {
	flex: 1 1 0;
	display: block;
	object-fit: cover;
}

.frame-scroller {
	display: flex;
	width: 100%;
	height: 100%;
}

.img.x .frame-scroller {
	overflow-x: auto;
	flex-direction: row;
}

.img.x img {
	height: 100%;
}

.img.y .frame-scroller {
	overflow-y: auto;
	flex-direction: column;
}

.img.y img {
	width: 100%;
}
</style>
