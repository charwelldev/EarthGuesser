import questions from '/src/assets/questions/questions.js';

import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import textureSvg from "/textures/map_no_countries.svg";

import countriesData from '/src/assets/countries/tesselations.json' with { type: "json" };
import extraCountriesData from '/src/assets/countries/delaunay.json' with { type: "json" };
import indicesMap from '/src/assets/questions/indicesMap.js';
import indicesContinents from './assets/questions/indicesContinents';
import Stats from 'stats.js';

import { getTodayQuiz, getGlobalStats, validateAnswer } from '/src/service/mainService.js';

import { Tween, Easing, Group, } from '@tweenjs/tween.js';;
import { LineSegmentsGeometry, LineMaterial } from 'three/examples/jsm/Addons.js';
import { Wireframe } from 'three/examples/jsm/Addons.js';

// Read query parameters
const gameType = window.location.hash.substring(1); // "space" or "planet"

// Apply logic based on game choice
if (gameType === 'quiz') {
    console.log("Starting Quiz mode");
} else if (gameType === 'random') {
    console.log("Starting Random mode");
    // initialize scene for planet builder
} else {
    console.log("No scene found");
    // fallback/default initialization
}

//User Id
var userId;

var camera, controls, groupTween, scene, tween;

const center = new THREE.Vector3(0, 0, 0);

var lineMaterial;

var centerOfCountries = {};

//Front end services and util functions
function getUserId() {
    userId = localStorage.getItem("userId");
    if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem("userId", userId);
    }
    return userId;
}

getUserId();

var labelSpritesGlobal = [];

var CountrySelected = [];
var wrongCountriesSelected = [];
var wrongCountriesSelectedObjects = [];

var solutions = [];
var resultsGlobal = [];

var coordinates;
var clicked = null;
var clickedWrong = null;

//Load the answers
solutions = await getTodayQuiz();
// console.log(solutions);

// Load the questions
solutions.forEach((item, index) => {
    const div = document.getElementById('q' + index);
    div.innerHTML = indicesMap[item];
    document.getElementById('q' + index + "-img").src = "/EarthGuesser/textures/flags/" + item + ".png";
});

// DynamicaHTML
const carousel = document.getElementById('carousel');
const slides = carousel.children;
const total = slides.length;
const dots = document.getElementById('dots').children;
const guesses = document.getElementById('guesses').children;
let index = 0;
let corusellIndex = []
function updateCarousel(countrySelected = null) {

    // Only update corusellIndex if a correct guess was clicked
    // if correct answer was clicked
    if (countrySelected !== null) {
        const solutionIndex = solutions.indexOf(countrySelected);

        if (!corusellIndex.includes(solutionIndex)) {
            corusellIndex.push(solutionIndex);
        }

        // move to next slide
        index = (solutionIndex + 1) % solutions.length;
    }


    // Move carousel to the current index
    carousel.style.transform = `translateX(-${index * 100}%)`;

    // Update guesses visibility
    const guessesDivs = document.querySelectorAll("#guesses > div");
    guessesDivs.forEach((guessDiv, i) => {
        if (i === index) {
            guessDiv.classList.remove("hidden");
            guessDiv.classList.add("block");
        } else {
            console.log("hidden");
            guessDiv.classList.add("hidden");
            guessDiv.classList.remove("block");
        }

        // Apply green for previous correct guesses
        if (corusellIndex.includes(index)) {
            console.log("In");
            //const guess = document.getElementById("guesses");
            guessDiv.classList.add("bg-green-500");
        } else {
            guessDiv.classList.remove("bg-green-500");
        }
    });

    // Update dots
    [...dots].forEach((dot, i) => {
        dot.classList.remove("bg-white", "bg-white/40");

        if (corusellIndex.includes(i)) dot.classList.add("bg-green-500");
        else if (i === index) dot.classList.add("bg-white");
        else dot.classList.add("bg-white/40");
    });
}

document.getElementById('next').onclick = () => {
    index = (index + 1) % total;
    updateCarousel();
};

document.getElementById('prev').onclick = () => {
    index = (index - 1 + total) % total;
    updateCarousel();
};

// Global game parameters
var endGame = false;
var triesCount = 5;
var isMobile = false;


// Game logic
function drawTries() {
    const tries = document.getElementById('countTries');
    tries.innerHTML = triesCount;

    if (isMobile) {
        /* const triesMobile = document.getElementById('triesCountMobile');
        triesMobile.innerHTML = "Remaining attempts: " + triesCount; */
    }

}

// Create Stats panel
const stats = new Stats();
stats.showPanel(0); // 0: FPS

// Store all resources (textures, meshes, etc.) produced by loading processes
var resources = {};
var countries = new THREE.Group();
var countriesExtra = new THREE.Group();
var textures = [];

const hoverColor = new THREE.Color(86, 148, 210).setHex(0x5694d2);
const redColor = new THREE.Color(255, 102, 102).setHex(0xff6666);
const originalColor = new THREE.Color(244, 67, 54).setHex(0xffffff);
const greenColor = new THREE.Color(102, 255, 102).setHex(0x66ff66);
const blueColor = new THREE.Color(0, 170, 255).setHex(0x00aaff);
const grayColor = new THREE.Color(108, 111, 127).setHex(0xb3b3b3);
const yellowColor = new THREE.Color(204, 204, 0).setHex(0xcccc00);

//Helpers for initScene
// Helper: generate a circular star sprite on an offscreen canvas
function generateStarSprite(size = 12) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    // center bright, edge transparent
    grad.addColorStop(0.0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.2, 'rgba(255,255,255,0.9)');
    grad.addColorStop(0.4, 'rgba(255,230,200,0.6)');
    grad.addColorStop(1.0, 'rgba(255,230,200,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const map = new THREE.CanvasTexture(c);
    map.needsUpdate = true;
    return map;
}



// Create a starfield using Points
// We'll make two layers:
//  - distantStars: many, small, slightly dim (gives depth)
//  - nearTwinklingStars: fewer, a touch larger, animated size/alpha for twinkle
function createStarPoints(count, radiusMin, radiusMax, sizeRange, isTwinkling = false) {
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
        // random direction on a sphere
        const u = Math.random();
        const v = Math.random();
        const theta = 2 * Math.PI * u;
        const phi = Math.acos(2 * v - 1);
        const dir = new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta),
            Math.sin(phi) * Math.sin(theta),
            Math.cos(phi)
        );
        // random radius in shell
        const r = radiusMin + Math.random() * (radiusMax - radiusMin);
        const idx = i * 3;
        positions[idx] = dir.x * r;
        positions[idx + 1] = dir.y * r;
        positions[idx + 2] = dir.z * r;

        sizes[i] = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);

        // color variation (slightly warm/cool)
        // New: mostly white stars with subtle blue variation
        const brightness = 0.9 + Math.random() * 0.1; // between 0.9 and 1.0
        const bluishTint = 0.97 + Math.random() * 0.03; // slightly cool
        colors[idx] = brightness * bluishTint;
        colors[idx + 1] = brightness * bluishTint;
        colors[idx + 2] = brightness;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starSprite = generateStarSprite(12);

    const material = new THREE.PointsMaterial({
        size: 0.1,
        map: starSprite,
        // sizeAttenuation true makes objects get smaller with distance (good for star realism)
        sizeAttenuation: true,
        transparent: true,
        depthWrite: false, // prevents z-fighting issues with additive
        blending: THREE.AdditiveBlending,
        vertexColors: true
    });

    const points = new THREE.Points(geometry, material);
    // store some metadata for animation
    points.userData = { isTwinkling: !!isTwinkling };
    return points;
}

async function validate() {
    
    solutions.forEach(async (country, i) => {

        if (CountrySelected.includes(country)) {
            console.log("Validate RIGHT answer");
            await validateAnswer(userId, country, true);
        } else {
            await validateAnswer(userId, country, false);
        }
    });

}

async function showResults(aciertos, total, scene) {

    showImageResults(scene);

    const gameStats = document.getElementById("gameStats");
    gameStats.classList.add("hidden");

    const results = document.getElementById("results");
    const aciertosDiv = document.getElementById("aciertos");
    const totalDiv = document.getElementById("total");
    const congrats = document.getElementById("congratulations");
    // DEBUG console.log(results);

    aciertosDiv.textContent = aciertos;
    totalDiv.textContent = total;

    results.classList.remove("hidden");

    if ((aciertos / total) > 0.2 && (aciertos / total) < 0.4) {
        aciertosDiv.classList.add("text-yellow-500");
        congrats.innerText = 'Almost';
    } else if ((aciertos / total) < 0.1) {
        aciertosDiv.classList.add("text-red-500");
        congrats.innerText = 'Good try';
    } else {
        aciertosDiv.classList.add("text-green-500")
        congrats.innerText = 'Congratulations';
    }


    //Load from backend
    resultsGlobal = await getGlobalStats(solutions);
    // DEBUG console.log(resultsGlobal);
    const orderedResultsGlobal = solutions.map(id => {
        const item = resultsGlobal.find(s => s.country_id === id);
        return {
            country_id: id,
            total_answers: item ? item.total_answers : 0,
            correctness: item ? item.correctness_pct : 0
        };
    });

    const chartContainer = document.getElementById('chart');

    // RESET chart — but keep structure
    //chartContainer.innerHTML = "";

    // Append bars
    orderedResultsGlobal.forEach(item => {
        const col = document.createElement('div');
        col.className = 'flex flex-col items-center justify-end gap-4';

        const percent = document.createElement('span');
        percent.textContent = `${Math.round(item.correctness)}%`;
        percent.className = 'text-sm font-medium';

        const bar = document.createElement('div');
        if (CountrySelected.includes(item.country_id)) {
            bar.className = 'bg-green-500 w-6 rounded-t z-20';
        } else {
            bar.className = 'bg-greycool w-6 rounded-t z-20';
        }

        bar.style.height = `${item.correctness * 2}px`;

        //Total answers
        const totalDiv = document.createElement('span');
        var totalAnswers;
        if (item.total_answers < 1) {
            totalAnswers = "0";
        }
        else if (item.total_answers < 50) {
            totalAnswers = "+10"
        } else if
            (item.total_answers < 100) { totalAnswers = "+50"; }
        else if (item.total_answers < 500) { totalAnswers = "+100"; }
        else if (item.total_answers < 1000) { totalAnswers = "+500"; }
        else { totalAnswers = "+1000"; }

        totalDiv.textContent = totalAnswers;
        totalDiv.className = 'text-sm font-medium';

        col.appendChild(percent);
        col.appendChild(bar);
        chartContainer.appendChild(col);

        document.getElementById('totals').appendChild(totalDiv);
    });

    const labelContainer = document.getElementById("chart-labels");
    const lineContainer = document.getElementById("chart-lines");

    const wrapperHeight = document.getElementById("chart").offsetHeight;
    for (let i = 10; i <= 100; i += 10) {
        const y = wrapperHeight - (wrapperHeight * (i / 100)); // bottom→top alignment

        // horizontal line
        const line = document.createElement("div");
        line.className = "absolute w-full border-t border-gray-400/30";
        line.style.top = `${y}px`;
        lineContainer.appendChild(line);

        // label
        const label = document.createElement("span");
        label.className = "chart-label";
        label.textContent = `${i}%`;
        label.style.top = `${y}px`;
        labelContainer.appendChild(label);
    }

    expandSubContainer();

}

function showImageResults(scene) {
    const imgResults = document.getElementById("imgResults").children;

    [...imgResults].forEach((img, i) => {
        img.src = "/EarthGuesser/textures/flags/" + solutions[i] + ".png";

        img.addEventListener("click", () => {
            cameraToMarker(camera, centerOfCountries[solutions[i]], 0.5)
        });
        if (CountrySelected.includes(solutions[i])) {
            img.classList.add("border-2", "border-green-500");
        } else {
            img.classList.add("border-2", "border-greycool");
        }
    });

    const nameResults = document.getElementById("nameResults").children;

    [...nameResults].forEach((name, i) => {
        name.innerHTML = indicesMap[solutions[i]];
    });
};

function getSceneCountries(scene) {

    const objectsToRaycast = [];
    scene.traverse((object) => {
        if ((object instanceof THREE.Mesh) && object.type != "AxesHelper") {
            objectsToRaycast.push(object);
        }
    });

    return objectsToRaycast;
}

//Dynamically highlight the correct answers
function showFadeMessage(countryId, type) {
    const message = document.getElementById('fadeMessage');
    message.textContent = indicesMap[countryId];
    message.style.opacity = 1;  // fade in
    const errorCount = document.getElementById("errorCountMessage");
    if (type == 'correct') {
        message.style.color = '#00e600';
    } else {
        message.style.color = '#ee3300';
        errorCount.style.opacity = 1;
        errorCount.style.color = '#ee3300';
        errorCount.textContent = `Errors remaining: ${triesCount}`;
    }
    // Wait 2 seconds, then fade out
    setTimeout(() => {
        message.style.opacity = 0;
        if (errorCount) errorCount.style.opacity = 0;
    }, 2000);

    message.class += "hidden";
}

function clearRedColoredCountries() {

    wrongCountriesSelected.forEach((wrongCountry) => {

        var country = scene.getObjectByName(wrongCountry);
        country.material.color = originalColor;

        var countryParts = lookForCountryParts(country.name);

        // Modify countryParts
        if (countryParts) {

            countryParts.forEach((object) => {
                if ((object instanceof THREE.Mesh)) {
                    object.material.color = originalColor;
                }
            });
        }

    })



}

function getObjectsByName(id) {

    let countriesList = []
    scene.traverse((object) => {
        if ((object instanceof THREE.Mesh) && object.name != "Earth globe" && object.name == id) {
            countriesList.push(object);
        }
    });

    return countriesList;

}

function addEdgesToCountry(countryMesh, color) {

    try {

        countryMesh.forEach((country) => {

            // 1. Extract only the edges
            const edges = new THREE.EdgesGeometry(country.geometry, 180);

            // 2. Get the vertex positions (flat Float32Array)
            const lineGeometry = new LineSegmentsGeometry().fromEdgesGeometry(edges);

            //const geometry = new THREE.BufferGeometry().setFromPoints(positions);

            /*         // 3. Create MeshLine from array
                    const meshLine = new MeshLine();
                    meshLine.setPoints(positions); // <<< MUST be positions, not geometry */

            lineMaterial = new LineMaterial({
                color: color,
                linewidth: 5, // adjust scale to see it
            });

            const wireframe = new Wireframe(lineGeometry, lineMaterial);
            wireframe.computeLineDistances();
            wireframe.scale.set(1, 1, 1);
            scene.add(wireframe);

        })

    } catch (error) {
        console.log("Error", error);
    }

}

function makeTextSprite(text) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    context.font = "10px Roboto";
    context.fillStyle = "black";
    context.fillText(text, 10, 10);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.2, 0.2, 0.2);  // adjust size

    return sprite;
}


function addEdgesToWrongCountries(countryArray, color) {

    try {

        countryArray.forEach((country) => {

            // 1. Extract only the edges
            const edges = new THREE.EdgesGeometry(country.geometry, 180);

            // 2. Get the vertex positions (flat Float32Array)
            const lineGeometry = new LineSegmentsGeometry().fromEdgesGeometry(edges);

            //const geometry = new THREE.BufferGeometry().setFromPoints(positions);

            /*         // 3. Create MeshLine from array
                    const meshLine = new MeshLine();
                    meshLine.setPoints(positions); // <<< MUST be positions, not geometry */

            lineMaterial = new LineMaterial({
                color: color,
                linewidth: color == greenColor ? 7.5 : 5, // adjust scale to see it
            });

            const wireframe = new Wireframe(lineGeometry, lineMaterial);
            wireframe.computeLineDistances();
            wireframe.scale.set(1, 1, 1);
            scene.add(wireframe);

        });

    } catch (error) {
        console.log("Error", error);
    }

}

function addLinesToCountries(scene, countries, selected, long = 1.1) {

    countries.forEach(countryName => {

        const countryMesh = getObjectsByName(countryName);
        if (!countryMesh) return;

        // Add edges line to solution country
        addEdgesToCountry(countryMesh, selected.includes(countryName) ? greenColor : grayColor);

        // Center of the country
        const bbox = new THREE.Box3().setFromObject(scene.getObjectByName(countryName));
        const center = new THREE.Vector3();
        bbox.getCenter(center);

        centerOfCountries[countryName] = center;

        // Line from origin to country center
        /* const points = [new THREE.Vector3(0, 0, 0), center.clone().multiplyScalar(long)];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0xffffff });
        scene.add(new THREE.Line(geometry, material));

        // Blue glowing sphere
        const sphereGeometry = new THREE.SphereGeometry(0.5 / 50, 32, 32);
        const sphereMaterial = new THREE.MeshBasicMaterial({
            color: selected.includes(countryName) ? greenColor : redColor,      // green or blue
            transparent: true,
            opacity: 1           // initial opacity
        });
        const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
        sphere.position.copy(center).multiplyScalar(long);
        scene.add(sphere);

        // Keep track of the label so we can update it in the animate loop
        labelSpritesGlobal.push(sphere); */

    });


}

function cameraToMarker(scene, marker, radius) {

    window.hideSubContainer();
    const distance = camera.position.distanceTo(center);
    radius = distance;
    const markerPos = new THREE.Vector3(marker.x, marker.y, marker.z);

    // --- 1. Compute current and target directions (unit vectors) ---
    const currentDir = new THREE.Vector3().subVectors(camera.position, center).normalize();
    const targetDir = new THREE.Vector3().subVectors(markerPos, center).normalize();

    // --- 2. Tween state ---
    const state = { t: 0 };

    tween = new Tween(state)
        .to({ t: 1 }, 1200)
        .easing(Easing.Quadratic.InOut)
        .onUpdate(() => {
            // Interpolate directions using slerp for smooth spherical motion
            const interpolatedDir = new THREE.Vector3().copy(currentDir).lerp(targetDir, state.t).normalize();

            // Set camera position at fixed radius
            camera.position.copy(interpolatedDir.multiplyScalar(radius));

            // Optional: keep looking at the sphere center while moving
            camera.lookAt(center);
        })
        .onComplete(() => {
            // Snap final look at the marker
            camera.lookAt(markerPos);
        })
        .start();

    groupTween = new Group();
    groupTween.add(tween);
}


function lookForCountryParts(id) {

    var countryParts = [];
    scene.traverse((object) => {
        if ((object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments) && object.name != "Earth globe" && object.name == id) {
            countryParts.push(object);
        }
    });

    return countryParts;
}


function initScene() {

    // Create a new Matrix4 to store the inverse matrix
    const inverseMatrix = new THREE.Matrix4();

    var controlsController;
    var globalConstantWireframe;

    var groupCountries, renderer, raycaster, raycasterCoordinates;
    var earthGlobe;

    var mouse = new THREE.Vector2();
    var mouseDownPosition = { x: 0, y: 0 };

    var intersected = null;

    const eartGlobeRadius = 0.5;

    const lod = new THREE.LOD();

    scene = new THREE.Scene();

    groupCountries = new THREE.Group();
    groupCountries.name = "Group Countries";

    var container = document.getElementById("main_container");

    var canvas = document.getElementById("earthCanvas");

    //75, 0.75 * window.innerWidth / window.innerHeight, 0.1, 2000
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 2000);
    camera.up = new THREE.Vector3(0, 1, 0);
    scene.background = new THREE.Color(20, 20, 26).setHex(0x02020d);
    window.zoom = null;

    //Initial render configuration
    renderer = new THREE.WebGLRenderer();
    // DEBUG console.log(renderer.info);
    if (container.clientWidth > 640) {
        renderer.setSize(container.clientWidth, container.clientHeight);
        window.isMobile = false;
    } else if (container.clientWidth < 640 || container.clientHeight < 640) {
        console.log("isMobile true");
        renderer.setSize(container.clientWidth, container.clientHeight);
        camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.01, 2000);
        isMobile = true;
        console.log("isMobile", isMobile);
        window.isMobile = true;
        const error = document.getElementById("errors");
        error.classList.add("text-black");
        error.innerText = "Errors";

    }

    // Load clues
    if (isMobile) {
        // Load the questions
        questions.forEach((item, index) => {
            /* const div = document.getElementById('clue' + index);
            div.innerHTML = item[0]; */
        });

    } else {
        document.body.appendChild(stats.dom);
    }

    canvas.appendChild(renderer.domElement);

    //Orbit controls
    controls = new OrbitControls(camera, renderer.domElement);

    controls.enabled = true;
    controls.enablePan = false;
    controls.minDistance = 0.52;
    controls.zoomSpeed = 0.2;
    if (isMobile) {
        controls.maxDistance = 0.576;
    } else {
        controls.maxDistance = 0.85;
        //controls.maxDistance = 5;
    }
    controls.enableDamping = true;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 0.6;

    var light = new THREE.AmbientLight(0xffffff, 3);
    scene.add(light);

    /* const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(0.5, 0.5, 3); */

    //Raycaster
    raycaster = new THREE.Raycaster();
    raycaster.name = "Raycaster";
    //raycaster.layers.set(1);
    raycaster.params.Line.threshold = 1;
    raycaster.params.Points.threshold = 1;

    //Raycaster coordinates
    raycasterCoordinates = new THREE.Raycaster();
    raycasterCoordinates.name = "Raycaster 2";

    // Last approach
    const raycasterCountries = new THREE.Raycaster();
    raycasterCountries.name = "raycasterCountries";
    raycasterCountries.params.Line.threshold = 1;
    raycasterCountries.params.Points.threshold = 1;

    //Initial camera poisition


    if (isMobile) {
        camera.position.set(0, 0, 1);
        controls.minDistance = 0.55;
        controls.maxDistance = 3;
        controls.zoomSpeed = 1;
        const dir = new THREE.Vector3(0, 0, 1); // camera direction (z-axis)
        const offset = dir.multiplyScalar(1.5);
        controls.object.position.copy(controls.target).add(offset);
    } else {
        camera.position.set(0, 0, 1);
        // Distant subtle stars
        const distantStars = createStarPoints(1200, 40, 140, [0.6, 1.6], false);
        scene.add(distantStars);

    }

    camera.lookAt(new THREE.Vector3(0, 0, 0));

    if (resources.svgEarthTexture) {
        const geometry = new THREE.SphereGeometry(eartGlobeRadius, 64, 64);
        const material = new THREE.MeshBasicMaterial({ map: resources.svgEarthTexture });

        earthGlobe = new THREE.Mesh(geometry, material);
        //earthGlobe.scale.set(0.7, 0.7, 0.7);
        //earthGlobe.rotation.set(0,0,0);
        earthGlobe.rotation.y = -Math.PI / 2;
        earthGlobe.name = 'Earth globe';
        // ---------- IMPORTANT
        scene.add(earthGlobe);
    } else {

    }

    if (countries) {
        // DEBUG console.log(countries);
        scene.add(countries);
    }

    if (countriesExtra) {
        scene.add(countriesExtra);
    }

    if (!isMobile) {
        //addCapitalCities();
    }

    // console.log(scene);


    generateStarSprite();

    //Dragging
    var isDragging = false;

    function render() {

        camera.updateMatrixWorld();

        raycasterCountries.setFromCamera(mouse, camera);

        var countryIntersected;
        var countryParts;

        // Perform raycasting and check for intersections
        // endGame
        if (!endGame && !(isMobile)) {  // Only check intersections if the cube exists

            //raycasterCountries.update(camera, mouse);

            const intersects = raycasterCountries.intersectObjects(getSceneCountries(scene), false);

            if (intersects.length > 0) {

                const worldPos = intersects[0].point;

                if (intersects[0].object.name != "Earth globe") {

                    // DEBUG console.log("solutions includes intersected.name", solutions.includes(intersects[0].object.name))
                    //&& !solutions.includes(intersected.name) && !solutions.includes(intersects[0].object.name)
                    if (intersected && !wrongCountriesSelected.includes(intersected.name) && !CountrySelected.includes(intersected.name)) {

                        //DEBUG 1 console.log("Intersected to original Color")
                        // console.log("Country intersected", intersected.name);

                        intersected.material.color = originalColor;

                        countryParts = lookForCountryParts(intersected.name);

                        // Modify countryParts
                        if (countryParts) {

                            countryParts.forEach((object) => {
                                if ((object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) {
                                    object.material.color = originalColor;
                                }
                            });

                        }


                        countryIntersected = null;
                        countryParts = [];
                    }

                    if (!wrongCountriesSelected.includes(intersects[0].object.name) && !CountrySelected.includes(intersects[0].object.name) && !intersects[0].object.name != "Earth Globe") {

                        //console.log("Test");

                        intersected = intersects[0].object;
                        intersected.material.color = hoverColor;

                        /* const homonimObject = intersected.parent.children;

                        homonimObject[homonimObject.length - 1].position.copy(transformPositionWithMagnitud(worldPos, intersected.matrixWorld)); */


                        countryParts = lookForCountryParts(intersected.name);

                        // Modify countryparts
                        if (countryParts) {
                            countryParts.forEach((object) => {
                                if ((object instanceof THREE.Mesh) || (object instanceof THREE.LineSegments)) {
                                    object.material.color = hoverColor;
                                }
                            });
                        }

                        countryIntersected = null;
                        countryParts = [];

                    }

                }

            } else {

                if (intersected && intersected.name != "Earth globe") {

                    // && !CountrySelected.includes(intersected.name)
                    if (intersected != null && !CountrySelected.includes(intersected.name) && !solutions.some(item => CountrySelected.includes(item))) {

                        intersected.material.color = originalColor;

                        countryParts = lookForCountryParts(intersected.name);

                        countryParts.forEach((object) => {
                            if ((object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) {
                                object.material.color = originalColor;

                            }
                        });


                    }

                    if (clickedWrong != null) {

                        var lastWrongCountryClicked = clickedWrong.name;

                        if (wrongCountriesSelected.includes(clicked.name) && clicked.name != "Earth globe" && lastWrongCountryClicked.name != "Earth Globe") {

                            clickedWrong.material.color = redColor;

                            var countryParts = lookForCountryParts(lastWrongCountryClicked);

                            // Modify countryParts
                            if (countryParts) {

                                countryParts.forEach((object) => {
                                    if ((object instanceof THREE.Mesh) && object.name != "Earth Globe") {
                                        object.material.color = redColor;
                                    }
                                });
                            }

                        }

                    }

                }



                //intersected = null;
                //countryParts = [];

            }

        } else if (endGame) {

            clearRedColoredCountries();

        }

        renderer.render(scene, camera);

    }

    function animate() {

        stats.begin();
        controls.update();

        const time = performance.now() * 0.002; // time in seconds

        var distance = camera.position.distanceTo(controls.target);

        if (labelSpritesGlobal) {
            labelSpritesGlobal.forEach(sphere => {

                // Pulsing scale
                const scale = 0.4 + (0.4 - 0.3) * Math.sin(time * 1.5); // 1.5 = speed of pulsing
                sphere.scale.set(scale / 2, scale / 2, scale / 2);

                // Pulsing opacity (optional)
                sphere.material.opacity = 1 + (1 - 0.9) * Math.sin(time * 1.5) / 2;

            });
        }

        if (lineMaterial) lineMaterial.resolution.set(window.innerWidth, window.innerHeight);

        //DEBUG console.log(distance);
        if (distance) window.zoom = distance;
        stats.end();
        if (groupTween) groupTween.update();
        render();
    }

    renderer.setAnimationLoop(animate);

    // Event functions
    //@params: event

    function onMouseDown(event) {

        if (event.target.tagName == 'CANVAS') {
            window.target = 'CANVAS';
        } else if (event.target.tagName == 'DIV') {
            window.target = 'DIV'
        }
        isDragging = false; // Reset the dragging state

    }

    function onMouseMove(event) {

        const dx = event.clientX - mouseDownPosition.x;
        const dy = event.clientY - mouseDownPosition.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // If the distance is greater than the threshold, set dragging to true
        const threshold = 5;
        if (distance > threshold) {
            isDragging = true;
        }

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
        mouse.y = - ((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

        //console.log("Pointer clicked, coordinates: ", pointer.x, pointer.y);

        if (!isMobile) {
            //Set raycaster position
            raycasterCoordinates.setFromCamera(mouse, camera);

            try {
                // Print the latitude and longitude of the point
                const coordinatesBox = document.getElementById('coordinates');

                const point = raycasterCoordinates.intersectObject(scene.getObjectByName("Earth globe"));
                if (point.length > 0) {
                    coordinates = PointToLatLon(point[0].point);
                    // DEBUG console.log(coordinates);

                    var { latitudeDMS, longitudeDMS } = formatLatLonToDMS(coordinates.latitude, coordinates.longitude);
                    // console.log(latitudeDMS, longitudeDMS);
                    coordinatesBox.innerHTML = latitudeDMS + " " + longitudeDMS;
                }

            } catch (error) {
                console.log(error);
            }


        }


    }

    function onMouseUp(event) {

        //console.log(event.target.tagName);
        if (!isDragging && event.target.tagName == 'CANVAS') {

            //DEBUG console.log(event.target.tagName);
            onMouseClick(event)

        }

        isDragging = false; // Reset the dragging state
    }


    function onMouseClick(event) {

        //console.log("INDEX SRC", slides[index]);
        const currentSlide = slides[index];
        const img = currentSlide.querySelector('img'); // finds the <img> inside the slide
        const src = img ? img.src : null;
        const match = src.match(/(\d+)\.png$/);
        const number = match ? match[1] : null;
        //console.log(number);


        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
        mouse.y = - ((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

        //console.log("Pointer clicked, coordinates: ", pointer.x, pointer.y);

        try {

            if ((event.button == 0 || event.touches[0]) && !endGame) {

                //Set raycaster position
                raycaster.setFromCamera(mouse, camera);

                var intersects = raycaster.intersectObjects(getSceneCountries(scene), false);
                // DEBUG console.log("right click", intersects);

                if (intersects.length > 0 && intersects[0].object.name != "Earth globe") {

                    clicked = intersects[0].object;
                    // DEBUG console.log("------------", clicked);

                    if (solutions.includes(clicked.name)) {

                        if (!endGame) {


                            if (!CountrySelected.includes(clicked.name)) {

                                CountrySelected.push(clicked.name);
                                clicked.material.map = textures[solutions.indexOf(clicked.name)];
                                clicked.material.color = null;
                                clicked.material.needsUpdate = true;

                                expandSubContainer();

                                updateCarousel(clicked.name);

                            }

                            var countryParts = lookForCountryParts(clicked.name);

                            // Modify countryParts
                            if (countryParts) {

                                countryParts.forEach((object) => {
                                    if ((object instanceof THREE.Mesh)) {
                                        object.material.map = textures[solutions.indexOf(clicked.name)];
                                        object.material.color = null;
                                        object.material.needsUpdate = true;
                                    }
                                });
                            }

                            if (isMobile) {
                                //markLastCountrySelectedMobile(clicked.name);
                                //markQuizQuestionMobile(clicked.name);
                            }

                            // DEBUG console.log("Dynamically change quiz");
                            //markQuizQuestions(clicked.name);
                            showFadeMessage(clicked.name, 'correct');


                        }

                        if ([...solutions].sort().toString() == [...CountrySelected].sort().toString()) {

                            // DEBUG console.log("Aciertos %", CountrySelected.length / solutions.length);

                            //showAnswers();

                            clearRedColoredCountries();
                            validate();
                            showResults(CountrySelected.length, solutions.length, scene);
                            addEdgesToWrongCountries(wrongCountriesSelectedObjects, redColor);
                            addLinesToCountries(scene, solutions, CountrySelected);

                            if (!isMobile) {
                                controlsController.setValue(false);
                            } else {
                                hideShowBorders(false);
                            }

                            endGame = true;
                        }

                    } else if (event.button == 0 || event.touches[0]) {

                        clickedWrong = intersects[0].object;
                        //console.log("-----CLICKED WRONG-------", clickedWrong);


                        if (!wrongCountriesSelected.includes(clickedWrong.name)) {
                            triesCount -= 1;
                        }

                        wrongCountriesSelected.push(clickedWrong.name);
                        wrongCountriesSelectedObjects.push(clickedWrong);

                        if (triesCount > 0) {

                            // DEBUG console.log("TRIES COUNT", triesCount);
                            drawTries();

                        } else if (triesCount == 0) {

                            endGame = true;
                            // DEBUG console.log("TRIES COUNT", triesCount);
                            drawTries();
                            //markWrongQuizQuestions();
                            //markWrongQuizQuestionsMobile();

                            // DEBUGconsole.log(solutions.length, CountrySelected.length)
                            // DEBUG console.log("Aciertos %", CountrySelected.length / solutions.length);
                            clearRedColoredCountries();
                            validate();
                            showResults(CountrySelected.length, solutions.length, scene);
                            addEdgesToWrongCountries(wrongCountriesSelectedObjects, redColor);
                            addLinesToCountries(scene, solutions, CountrySelected);

                            if (!isMobile) {
                                controlsController.setValue(false);
                            } else {
                                hideShowBorders(false);
                            }

                            // DEBUG console.log("Sin más oportunidades");
                            //showAnswers();

                            //Draw wrong selection
                            solutions.forEach(countryId => {
                                scene.traverse((object) => {
                                    if ((object instanceof THREE.Mesh && object.name == countryId && !CountrySelected.includes(countryId))) {
                                        // DEBUG console.log("Draw");
                                        object.material.map = textures[solutions.indexOf(countryId)];
                                        object.material.color = null;
                                        object.material.needsUpdate = true;
                                    }
                                });

                            });

                        }

                        showFadeMessage(clickedWrong.name, 'wrong');

                        clickedWrong.material.color = redColor;

                        var countryParts = lookForCountryParts(clickedWrong.name);

                        // Modify countryParts
                        if (countryParts) {

                            countryParts.forEach((object) => {
                                if ((object instanceof THREE.Mesh)) {
                                    object.material.color = redColor;
                                }
                            });
                        }

                        if (isMobile) {
                            //markLastCountrySelectedMobile(clickedWrong.name);
                            //console.log(clicked.name);
                        }

                    }

                    // DEBUG console.log(clicked);

                    renderer.render(scene, camera);

                    controls.update();

                }
            }
        } catch (error) {
            console.log(error);

        }


    }

    //Events
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Touch event listener for iOS compatibility
    window.addEventListener("touchstart", onMouseClick);

    // Handle window resize
    window.addEventListener('resize', () => {
        var scopeCanvas = document.getElementById("main_container");
        const width = scopeCanvas.offsetWidth;
        const height = scopeCanvas.offsetHeight;

        renderer.setSize(width, height);

        if (container.clientWidth > 768) {
            const width = scopeCanvas.offsetWidth;
            const height = scopeCanvas.offsetHeight;
            renderer.setSize(width, height);
        } else {
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
        camera.updateProjectionMatrix();
        camera.aspect = width / height;


    }), false;

    window.mobileCheck = function () {
        isMobile = (function (a) {
            if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0, 4))) check = true;
        })(navigator.userAgent || navigator.vendor || window.opera);
        console.log("ISMOBILE");
        return check;
    };

    if (!isMobile) {

        // GUI
        const gui = new GUI({ container: document.getElementById('gui-container') });

        const params = {
            wireframe: true,
        }

        controlsController = gui.add(params, 'wireframe').name('Edges').onChange((value) => {
            globalConstantWireframe = value;
            // DEBUG console.log(value);
            hideShowBorders(value);
        });

    }

}

function hideShowBorders(visible) {
    scene.traverse((object) => {
        if ((object instanceof THREE.LineSegments)) {
            object.visible = visible;
        }
    });
}

// IMPORTANT FORMER FUNCTION
function generateCountryGeometry(delaunayPointsIn3D, triangles, countryId, thickness = 0.0018) {

    //console.log(delaunayPointsIn3D);

    // Step 1: Validate and sanitize points
    const validPoints = [];
    delaunayPointsIn3D.forEach(p => {
        if (!Array.isArray(p) || p.length != 3) {
            //console.warn(`Invalid 3D point at index ${i}: ${JSON.stringify(p)}. Replacing with [0, 0, 0].`);
            validPoints.push([0, 0, 0]); // Default to origin for invalid points
        } else {
            const magnitude = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
            var scale = null;
            if (countryId == 164) {
                scale = (magnitude + 0.004) / magnitude;
            } else {
                scale = (magnitude + thickness) / magnitude;
            }
            validPoints.push([p[0] * scale, p[1] * scale, p[2] * scale]); // Ensure numbers
        }

    });

    // Step 5: Create geometry with vertices and faces
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(validPoints.flat()); // z = 0 for 2D
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

    // DEBUG Check if all vertices are zero
    const allZeros = Array.from(vertices).every(v => v === 0);
    if (allZeros) console.error("All vertices are [0, 0, 0]. Geometry will not be visible.");

    // Validate triangles
    const numPoints = validPoints.length;
    const validTriangles = triangles.filter(t => {
        if (!Array.isArray(t) || t.length !== 3) {
            console.warn(`Invalid triangle: ${JSON.stringify(t)}. Skipping.`);
            return false;
        }
        const [i1, i2, i3] = t;
        if (i1 >= numPoints || i2 >= numPoints || i3 >= numPoints ||
            isNaN(i1) || isNaN(i2) || isNaN(i3)) {
            console.warn(`Triangle out of bounds: ${JSON.stringify(t)}. Skipping.`);
            return false;
        }
        // Check for degenerate triangles (all indices the same)
        if (i1 === i2 || i2 === i3 || i1 === i3) {
            console.warn(`Degenerate triangle: ${JSON.stringify(t)}. Skipping.`);
            return false;
        }
        return true;
    });

    // Convert triangles to flat array of indices
    const myIndices = new Uint32Array(validTriangles.flat());
    geometry.setIndex(new THREE.BufferAttribute(myIndices, 1));

    geometry.computeVertexNormals();  // Compute normals for the faces

    //Apply texture to geometry
    geometry.computeBoundingBox();

    const pos = geometry.attributes.position;
    const norm = geometry.attributes.normal;
    const uv = new Float32Array(pos.count * 2);

    const bbox = geometry.boundingBox;
    const size = new THREE.Vector3();
    bbox.getSize(size);

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);
        const nx = norm.getX(i);
        const ny = norm.getY(i);
        const nz = norm.getZ(i);

        let u, v;

        // Pick the dominant axis of the normal to decide projection
        const ax = Math.abs(nx);
        const ay = Math.abs(ny);
        const az = Math.abs(nz);

        if (ay >= ax && ay >= az) {
            // Project on XZ plane (top/bottom)
            u = (x - bbox.min.x) / size.x;
            v = (z - bbox.min.z) / size.z;
        } else if (ax >= ay && ax >= az) {
            // Project on YZ plane (side)
            u = (z - bbox.min.z) / size.z;
            v = (y - bbox.min.y) / size.y;
        } else {
            // Project on XY plane (front/back)
            u = (x - bbox.min.x) / size.x;
            v = (y - bbox.min.y) / size.y;
        }

        if (countryId == 49) {

            // Define rotation parameters
            const angle = - Math.PI / 2; // 180° rotation
            const cosA = Math.cos(angle);
            const sinA = Math.sin(angle);

            u -= 0.5;
            v -= 0.5;
            // Rotate
            const uRot = u * cosA - v * sinA;
            const vRot = u * sinA + v * cosA;

            // Move back to [0, 1] range
            u = uRot + 0.5;
            v = vRot + 0.5;

        } else if (countryId == 10) {

            u = (z - bbox.min.z) / size.z;
            v = (y - bbox.min.y) / size.y;

            u *= 1;
            v *= 1;

        } else if (countryId == 92) {

            u = (z - bbox.min.z) / size.z;
            v = (y - bbox.min.y) / size.y;

            u *= 1.9;
            v *= 1.9;
        }

        uv[i * 2] = u;
        uv[i * 2 + 1] = v;
    }

    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.attributes.uv.needsUpdate = true;

    //DEBUG console.log("INDEX", geometry.index.array.constructor.name);

    // Wireframe
    var geo = new THREE.EdgesGeometry(geometry, 180); // or WireframeGeometry
    var mat = new THREE.LineBasicMaterial({ color: 0x000000 });
    var wireframe = new THREE.LineSegments(geo, mat);
    try {
        //scene.add(wireframe)
    }
    catch (error) {
        console.log(error);
    }

    // Step 7: Return both the geometry and edge geometry
    return { geometry, wireframe };
}



function generateCountry(arrayOf2DPoints, arrayTriangles, countryId) {

    // DEBUG console.log("Country generated with Id: ", countryId);
    return generateMeshAndWireframe(arrayOf2DPoints, arrayTriangles, countryId);

    //scene.add(groupCountries);
    //console.log("Scene", scene);

}

function generateArrayPointsIn3D(array) {

    const outerPoints = array[0];
    const innerPoints = array[1];

    var outerPoints_out = [];
    var innerPoints_out = [];

    outerPoints.forEach((point, idx) => {
        outerPoints_out.push(latLonTo3DSphere(point.x, point.y))
    })

    innerPoints.forEach((point, idx) => {
        innerPoints_out.push(latLonTo3DSphere(point.x, point.y))
    })

    return [outerPoints_out, innerPoints_out]


}

function generateDelaunayPointsIn3D(array, indice) {

    //console.log(array);

    // Constraint in pol2tri for not repeating points, in array last == first
    const polyPoints = array[0].slice(0, -1);

    //console.log(polyPoints);

    var contour = [];
    var hole = [];

    array[0].forEach((point, idx) => {
        if (point.x == null || point.y == null) {
            // DEBUG console.log("Point is null", point.x, point.y);
            contour.push(new poly2tri.Point(point.x, point.y));
        } else {
            contour.push(new poly2tri.Point(point.x, point.y));
        }
    })

    array[1].forEach((point, idx) => {
        if (point.x == null || point.y == null) {
            // DEBUG console.log("Point is null", point.x, point.y);
            hole.push(new poly2tri.Point(point.x, point.y));
        } else {
            hole.push(new poly2tri.Point(point.x, point.y));
        }
    })

    var delaunayPointsIn3D = [];

    try {
        // Create a SweepContext with the points
        var swctx = new poly2tri.SweepContext(contour, { cloneArrays: true });

        swctx.addHole(hole);

        // Perform the triangulation using SweepContext
        const triangles = swctx.triangulate().getTriangles();

        triangles.forEach(function (triangle) {

            var myArray = triangle.getPoints();

            myArray.forEach(function (pArray) {

                var point = latLonTo3DSphere(pArray.x, pArray.y);
                if (point.x == null || point.y == null || point.z == null) {
                    // DEBUG console.log("Point Delaunay coordinate equal 0");
                }

                delaunayPointsIn3D.push([point.x, point.y, point.z]);

            });

        });

    } catch (error) {
        console.error("Error in Constrained Delaunay Triangulation", error);
        countriesNotLoaded += 1;
    } finally {



    };

    return delaunayPointsIn3D;

}

function generateMeshPointsIn3D(array, countryId) {


    // Constraint in pol2tri for not repeating points, in array last == first
    //const polyPoints = array.slice(0, -1);

    var delaunayPointsIn3D = []

    array.forEach(function (p, index) {

        var point = latLonTo3DSphere(p[0], p[1]);
        //console.log("point", point);
        if (point.x == null || point.y == null || point.z == null) {
            // DEBUG console.log("Point Delaunay coordinate equal 0");
        } else {

            //Excepcion antartico
            if (countryId == '164') {
                //point.x > 87.93 && point.x > 88.26 && point.y 
                if ((point.x < 0.07 && point.x > -0.07) && point.y < -0.4999977365 && (point.z < 0.01 || point.z > -0.01)) {
                    if ((p[1] > 179.0 || p[1] < -179.0)) {
                        //console.log(point);
                        //console.log(p[0], p[1]);
                        delaunayPointsIn3D.push([point.x, point.y + 0.02, point.z]);
                    } else {
                        //console.log(point.x, point.y, point.z);
                        delaunayPointsIn3D.push([0, -0.5, 0]);
                    }
                } else {
                    delaunayPointsIn3D.push([point.x, point.y, point.z]);
                }
            } else {
                delaunayPointsIn3D.push([point.x, point.y, point.z]);
            }

        }



    });

    return delaunayPointsIn3D;

}

function generateMeshAndWireframe(array, triangles, countryId) {


    const meshPointsIn3D = generateMeshPointsIn3D(array, countryId);

    // ------- IMPORTANTconsole.log(getGenerateCountryGeometryAndEdgeGeometryFromPoints(array));
    const geometryAndEdges = generateCountryGeometry(meshPointsIn3D, triangles, countryId);

    // Generate geometry from the points
    const g = geometryAndEdges.geometry;

    const m = new THREE.MeshBasicMaterial({
        color: originalColor,
        side: THREE.DoubleSide,
    });

    const groupCountryAndWireframe = new THREE.Group();
    groupCountryAndWireframe.name = "groupCountryAndWireframe";

    // solid mesh
    var mesh = new THREE.Mesh(g, m);
    // --------- IMPORTANT 
    mesh.name = countryId;

    // Performance
    mesh.matrixAutoUpdate = false;

    groupCountryAndWireframe.add(mesh);

    // Create the edges material
    const edgeMesh = geometryAndEdges.wireframe;
    edgeMesh.visible = true;
    edgeMesh.name = countryId;

    groupCountryAndWireframe.add(edgeMesh);

    return groupCountryAndWireframe;
}


function latLonTo3DSphere(lat, lon, radius = 0.5) {

    // Convert latitude and longitude from degrees to radians
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;

    //console.log(latRad, lonRad);
    // Cartesian coordinates based on spherical coordinates
    const x = radius * Math.cos(latRad) * Math.sin(lonRad);  // Longitude affects X
    const y = radius * Math.sin(latRad);  // Latitude affects Y
    const z = radius * Math.cos(latRad) * Math.cos(lonRad);  // Longitude affects Z

    return new THREE.Vector3(x, y, z);
}

//Translate point in 3D space to coordinates
function PointToLatLon(point, radius = 0.5) {

    const x = point.x / radius;
    const y = point.y / radius;
    const z = point.z / radius;

    // Standard spherical conversion
    const latitude = Math.atan2(y, Math.sqrt(x * x + z * z));
    let longitude = Math.atan2(z, x) - Math.PI / 2;

    // Normalize longitude range (−π to π)
    if (longitude > Math.PI) longitude -= 2 * Math.PI;
    if (longitude < -Math.PI) longitude += 2 * Math.PI;


    const toDeg = 180 / Math.PI;
    return {
        latitude: latitude * toDeg,
        longitude: longitude * toDeg
    };
}

function formatLatLonToDMS(latitude, longitude) {

    // DEBUG console.log(latitude, longitude);
    function toDMS(deg, isLat) {
        const absolute = Math.abs(deg);
        const degrees = Math.floor(absolute);
        const minutesFloat = (absolute - degrees) * 60;
        const minutes = Math.floor(minutesFloat);
        const seconds = (minutesFloat - minutes) * 60;

        const direction = isLat
            ? deg >= 0 ? 'N' : 'S'
            : deg <= 0 ? 'E' : 'W';

        return `${degrees}° ${minutes}' ${seconds.toFixed(2)}" ${direction}`;
    }

    return {
        latitudeDMS: toDMS(latitude, true),
        longitudeDMS: toDMS(longitude, false)
    };
}


// Intial loader configuration
// Create a Loading manager
let assetsLoaded = false;
let countriesNotLoaded = 0;

let isSceneInitialized = false;
const loadingManager = new THREE.LoadingManager();

let loaderId;

loadingManager.onStart = function (url, itemsLoaded, itemsTotal) {
    // DEBUG console.log("Loading started...");
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'flex';
    loaderId = document.getElementById('loaderId');
    // DEBUG console.log(loaderId);

    // DEBUG console.log(`Started loading ${url}. ${itemsLoaded}/${itemsTotal} items.`);
}

loadingManager.onProgress = (url, itemsLoaded, itemsTotal, progressEvent) => {

    const progressPercentage = (itemsLoaded / itemsTotal) * 100;

    if (loaderId) loaderId.innerHTML = 'Loading';

    // DEBUG console.log(`Progress: ${url} loaded. ${itemsLoaded}/${itemsTotal} items.`);

};

loadingManager.onLoad = function () {

    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';

    const subContainer = document.getElementById('sub_container');
    if (!isMobile) {
        if (subContainer) subContainer.classList.remove('md:hidden');
        // console.log("REMOVE HIDDEN");
    } else {
        if (subContainer) subContainer.classList.remove('hidden');
    }

    if (!isSceneInitialized) {
        // DEBUG console.log("onLoad - Initializing scene...");
        initScene();
        isSceneInitialized = true;
    } else {
        console.warn("onLoad - Scene already initialized, skipping...");
    }

};

loadingManager.onError = function (url) {
    console.error('Error loading resource:', url);
};


// Instantite the loaders
async function loadSVGFileToTexture(filePath, manager) {
    const uniqueId = filePath; // Unique identifier for this task
    //manager.itemStart(uniqueId); // Notify manager that this task has started */
    // DEBUG console.log(`loadSVG - itemStart: ${uniqueId}`);

    try {
        // Fetch the SVG file content
        const response = await fetch(filePath);
        const svgString = await response.text();

        // Create an image element
        const img = new Image();

        // Create a canvas to draw the SVG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Create a Blob from the SVG string
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
        const svgUrl = URL.createObjectURL(svgBlob);
        img.src = svgUrl; // Set the image source to the SVG URL

        // Wait for the image to load and decode
        const texture = await new Promise((resolve, reject) => {
            img.onload = async () => {
                try {
                    // Ensure image is decoded (optional, for robustness)
                    if ('decode' in img) {
                        await img.decode().catch(() => console.warn("SVG decode failed"));
                    }
                    canvas.width = img.width - 7; // Your offset
                    canvas.height = img.height;
                    ctx.drawImage(img, 4, 0, img.width - 7, img.height, 0, 0, canvas.width, canvas.height);
                    const texture = new THREE.CanvasTexture(canvas);
                    texture.needsUpdate = true; // Ensure WebGL updates the texture
                    URL.revokeObjectURL(svgUrl); // Clean up
                    resolve(texture);
                } catch (error) {
                    reject(error);
                }
            };
            img.onerror = () => reject(new Error("Failed to load SVG image"));
        });

        resources.svgEarthTexture = texture;
        // DEBUG console.log(resources.svgEarthTexture);

        manager.itemEnd(uniqueId); // Notify manager that this task is complete
        // DEBUG console.log(`loadSVG - itemEnd: ${uniqueId}`);
        return texture;
    } catch (error) {
        manager.itemError(uniqueId);
        console.error("Error loading or processing SVG file:", error);
        throw error;
    }
}

async function loadCountries(manager, countriesArray = countriesData) {
    const uniqueId = 'loading-countries';
    //manager.itemStart(uniqueId);
    // DEBUG console.log(countriesArray)
    try {

        solutions.forEach(function (solution) {
            textures.push(new THREE.TextureLoader().load(`/EarthGuesser/textures/flags/${solution}.png`))
        });

        const geometries = await new Promise((resolve) => {

            const groupCountries = new THREE.Group()

            countriesArray.forEach(function (countryArray, idx) {
                manager.itemStart(idx);
                var country = {}
                const [points, triangles, id] = countryArray;

                groupCountries.add(generateCountry(points, triangles, id));
                // DEBUG console.log(`loadCountry - itemEnd: ${idx}`);
                manager.itemEnd(idx);

            });
            resolve(groupCountries);
        });

        countries = geometries;
        // DEBUG console.log(countries);
        manager.itemEnd(uniqueId);
        return geometries;
    } catch (error) {
        manager.itemError(uniqueId);
        console.error(`loadModel - Error:`, error);
        throw error;
    }

}

function generateExtraCountryGeometry(pointsArray, delaunayPointsIn3D, thickness = 0.002) {


    // Step 1: Validate inputs
    if (!Array.isArray(pointsArray) || pointsArray.length < 2) {
        throw new Error("pointsArray must contain at least two arrays (outer and inner borders).");
    }
    const outerPoints = pointsArray[0];
    const innerPoints = pointsArray[1];

    if (!Array.isArray(outerPoints) || outerPoints.length === 0) {
        throw new Error("outerPoints must be a non-empty array of points.");
    }
    if (!Array.isArray(innerPoints) || innerPoints.length === 0) {
        throw new Error("innerPoints must be a non-empty array of points.");
    }
    if (!Array.isArray(delaunayPointsIn3D) || delaunayPointsIn3D.length === 0) {
        throw new Error("delaunayPointsIn3D must be a non-empty array of triangles.");
    }

    const numOuterPoints = outerPoints.length;
    const numInnerPoints = innerPoints.length;
    const numPoints = numOuterPoints + numInnerPoints;

    // Step 2: Create vertex positions
    const positions = []; // Array to store vertex positions (x, y, z)

    // Step 2: Create vertex positions from pointsArray
    const allPoints = outerPoints.concat(innerPoints);
    const pointToIndex = new Map();
    allPoints.forEach((point, index) => {
        const magnitude = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
        const scale = (magnitude + thickness) / magnitude;
        positions.push(point.x * scale, point.y * scale, point.z * scale);
        pointToIndex.set(`${point.x},${point.y},${point.z}`, index);
    });

    // Step 3: Convert delaunayPointsIn3D points to indices (assuming it's a flat list of points)
    const indices = [];
    if (delaunayPointsIn3D[0].length === 3 && typeof delaunayPointsIn3D[0][0] === 'number') {
        // delaunayPointsIn3D is [[x1, y1, z1], [x2, y2, z2], ...]
        // We need to group into triangles (assuming every 3 points is a triangle)
        for (let i = 0; i < delaunayPointsIn3D.length - 2; i += 3) {
            const p1 = delaunayPointsIn3D[i];
            const p2 = delaunayPointsIn3D[i + 1];
            const p3 = delaunayPointsIn3D[i + 2];

            const i1 = pointToIndex.get(`${p1[0]},${p1[1]},${p1[2] || 0}`);
            const i2 = pointToIndex.get(`${p2[0]},${p2[1]},${p2[2] || 0}`);
            const i3 = pointToIndex.get(`${p3[0]},${p3[1]},${p3[2] || 0}`);

            if (i1 === undefined || i2 === undefined || i3 === undefined) {
                console.warn(`Triangle at ${i} has unmapped points:`, [p1, p2, p3]);
                continue;
            }
            if (i1 === i2 || i2 === i3 || i1 === i3) {
                console.warn(`Degenerate triangle at ${i}: [${i1}, ${i2}, ${i3}]`);
                continue;
            }

            indices.push(i1, i2, i3);
        }
    } else {
        console.error('delaunayPointsIn3D format unexpected. Expected [[x, y, z], ...]. Received:', delaunayPointsIn3D[0]);
    }

    // Step 4: Validate indices
    if (indices.length === 0) {
        console.error('No valid triangles were added to indices. Check delaunayPointsIn3D.');
    } else if (indices.every(index => index === 0)) {
        console.error('All indices are 0. This indicates a problem with delaunayPointsIn3D or index processing.');
    }

    // Step 4: Create the BufferGeometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    if (indices.length > 0) {
        const indexBuffer = new THREE.Uint32BufferAttribute(indices, 1);
        geometry.setIndex(indexBuffer);

        // Immediately check the indices after setting
        const setIndices = geometry.getIndex();
        if (setIndices && setIndices.array.every(index => index === 0)) {
            console.error('Indices are all 0 after setIndex. Something went wrong with setting the index buffer.');
        }
    }

    //Apply texture to geometry
    geometry.computeBoundingBox();

    const pos = geometry.attributes.position;
    const uv = new Float32Array(pos.count * 2);
    const bbox = geometry.boundingBox;
    const size = new THREE.Vector3();
    bbox.getSize(size);

    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const z = pos.getZ(i);

        // For top-down projection (XZ)
        const u = (x - bbox.min.x) / size.x;
        const v = (y - bbox.min.y) / size.y;

        uv[i * 2] = u;
        uv[i * 2 + 1] = v;
    }

    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));

    const positions2 = geometry.getAttribute('position').array;
    const uniquePositions = new Set();
    for (let i = 0; i < positions2.length; i += 3) {
        const pos = `${positions2[i]},${positions2[i + 1]},${positions2[i + 2]}`;
        uniquePositions.add(pos);
    }

    const geometry2 = geometry;
    // Step 6: Return the geometry
    return { geometry, geometry2 };
}


function generateExtraMeshAndWireframe(array, countryId) {

    //Correct
    //console.log("Country points", array);
    const arrayIn3D = generateArrayPointsIn3D(array);
    const delaunayPointsIn3D = generateDelaunayPointsIn3D(array, countryId);

    // ------- IMPORTANTconsole.log(getGenerateCountryGeometryAndEdgeGeometryFromPoints(array));
    const geometryAndEdges = generateExtraCountryGeometry(arrayIn3D, delaunayPointsIn3D);

    // Generate geometry from the points
    const g = geometryAndEdges.geometry;


    // Generate material
    const m = new THREE.MeshBasicMaterial({
        color: originalColor,
        side: THREE.DoubleSide,
        transparent: false,
        opacity: 1,
    });

    const groupCountryAndWireframe = new THREE.Group();
    groupCountryAndWireframe.name = "group Extra";

    // solid mesh START
    var mesh = new THREE.Mesh(g, m);
    mesh.name = countryId + 200;

    // --------- IMPORTANT 
    groupCountryAndWireframe.add(mesh);

    // Create the edges material
    var geo = new THREE.EdgesGeometry(g, 30); // or WireframeGeometry
    var mat = new THREE.LineBasicMaterial({ color: 0x000000 });
    var wireframe = new THREE.LineSegments(geo, mat);
    wireframe.visible = true;
    wireframe.name = countryId + 200;

    groupCountryAndWireframe.add(wireframe);

    return groupCountryAndWireframe;
}

async function loadPolyCountries(manager, countriesExtraData = extraCountriesData) {
    const uniqueId = 'loading-countries-extra';
    try {

        const groupCountriesExtra = new THREE.Group();
        groupCountriesExtra.name = "extra Countries";

        const geometriesExtra = await new Promise((resolve) => {

            countriesExtraData.forEach(function (extraCountryArray, idx) {
                manager.itemStart(idx);

                groupCountriesExtra.add(generateExtraMeshAndWireframe(extraCountryArray, idx));

                manager.itemEnd(idx);
            });

            resolve(groupCountriesExtra);
        });

        countriesExtra = geometriesExtra;
        // DEBUG console.log(countries);
        manager.itemEnd(uniqueId);
        return geometriesExtra;

    } catch (error) {
        console.error(`loadModel - Error:`, error);
        throw error;
    }

}


// Main async function to load everything
async function loadResources() {
    console.log("loadResources - Starting...");
    try {
        const svgId = textureSvg;
        const countriesId = 'loading-countries';
        const countriesExtraId = 'loading-countries-extra';
        loadingManager.itemStart(svgId);
        loadingManager.itemStart(countriesId);
        loadingManager.itemStart(countriesId);

        // Load SVG texture
        const svgPromise = await loadSVGFileToTexture(svgId, loadingManager)

        const modelCountryPromise = await loadCountries(loadingManager);

        const modelCountryExtraPromise = await loadPolyCountries(loadingManager);

        // Wait for all promises to resolve
        const [svgEarthTexture, modelCountryGroup, modelCountryExtraGroup] = await Promise.all([svgPromise, modelCountryPromise, modelCountryExtraPromise]);


    } catch (error) {
        console.error("Error loading resources:", error);
    }
}

if (!window.hasRunLoadResources) {
    window.hasRunLoadResources = true;
    loadResources();
} else {
    console.warn("loadResources already called, skipping...");
}

