import * as THREE from 'three';

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

import textureSvg from "/textures/map_no_countries.svg"

import countriesData from '/src/assets/countries/tesselations.json' with { type: "json" };
import extraCountriesData from '/src/assets/countries/delaunay.json' with { type: "json" };
import indicesMap from '/src/assets/questions/indicesMap.js';
import questions from '/src/assets/questions/questions.js';

var CountrySelected = [];
var wrongCountriesSelected = [];
var solutions = [];

//Load the answers
questions.forEach((solution) => { solutions.push(solution[2]) });

// Load the questions
questions.forEach((item, index) => {
    const div = document.getElementById('q' + index);
    div.innerHTML = item[0];
});

// Global game parameters
var endGame = false;
var triesCount = 9;
var isMobile = false;


// Game logic
function drawTries() {
    const tries = document.getElementById('countTries');
    tries.innerHTML = triesCount;
}


// Store all resources (textures, meshes, etc.) produced by loading processes
var resources = {};
var countries = new THREE.Group();
var countriesExtra = new THREE.Group();


const hoverColor = new THREE.Color(111, 168, 220).setHex(0x6FA8DC);
const selectedColor = new THREE.Color(0, 230, 0).setHex(0x00e600);
const redColor = new THREE.Color(224, 102, 102).setHex(0xE06666);
const originalColor = new THREE.Color(244, 67, 54).setHex(0xffffff);
const yellowColor = new THREE.Color(179, 157, 81).setHex(0xb39d51);
const originCoordinates = new THREE.Vector3(0, 0, 0);


function initScene() {


    var earth, pointerModel, scene, groupCountries, camera, renderer, raycaster;
    var earthGlobe;

    var mouse = new THREE.Vector2();
    var mouseDownPosition = { x: 0, y: 0 };

    var intersected;

    const eartGlobeRadius = 0.5;

    var globalConstantWireframe = false;

    scene = new THREE.Scene();
    groupCountries = new THREE.Group();
    groupCountries.name = "Group Countries";

    var container = document.getElementById("main_container");

    var canvas = document.getElementById("earthCanvas");

    camera = new THREE.PerspectiveCamera(75, 0.75 * window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.up = new THREE.Vector3(0, 1, 0);
    scene.background = new THREE.Color(0x0f141c);

    //Initial render configuration
    renderer = new THREE.WebGLRenderer();
    if (container.clientWidth > 640) {
        renderer.setSize(0.75 * container.clientWidth, container.clientHeight);
    } else if (container.clientWidth < 640) {
        renderer.setSize(container.clientWidth, container.clientHeight);
        isMobile = true;
    }


    canvas.appendChild(renderer.domElement);

    //Axis helper
    const axesHelper = new THREE.AxesHelper(3);
    scene.add(axesHelper);

    //Orbit controls
    const controls = new OrbitControls(camera, renderer.domElement);

    controls.enabled = true;
    controls.enablePan = false;
    //controls.minDistance = 0.625;
    controls.minDistance = 0.62;
    controls.zoomSpeed = 0.5;
    controls.maxDistance = 1;
    controls.enableDamping = true;
    controls.autoRotate = false;
    controls.autoRotateSpeed = 1;

    var light = new THREE.AmbientLight(0xffffff, 3);
    scene.add(light);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1)
    directionalLight.position.set(0.5, 0.5, 3);

    //Raycaster
    raycaster = new THREE.Raycaster();
    raycaster.name = "Raycaster";
    //raycaster.layers.set(1);
    raycaster.params.Line.threshold = 1;
    raycaster.params.Points.threshold = 1;

    // Last approach
    const raycasterCountries = new THREE.Raycaster();
    raycasterCountries.name = "raycasterCountries";
    raycasterCountries.params.Line.threshold = 1;
    raycasterCountries.params.Points.threshold = 1;

    //Initial camera poisition
    camera.position.set(0, 0, 1);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    if (resources.svgEarthTexture) {
        const geometry = new THREE.SphereGeometry(eartGlobeRadius, 64, 64);
        const material = new THREE.MeshStandardMaterial({ map: resources.svgEarthTexture });

        earthGlobe = new THREE.Mesh(geometry, material);
        //earthGlobe.scale.set(0.7, 0.7, 0.7);
        //earthGlobe.rotation.set(0,0,0);
        earthGlobe.rotation.y = -Math.PI / 2;
        earthGlobe.name = 'Earth globe';
        // ---------- IMPORTANT
        scene.add(earthGlobe);
    } else {
        console.log("No svgEarthTexture");
    }

    if (countries) {
        // DEBUG console.log(countries);
        scene.add(countries);
    }

    if (countriesExtra) {
        scene.add(countriesExtra);
    }

    //Dragging
    var isDragging = false;

    function lookForCountryParts(id) {

        var countryParts = [];
        scene.traverse((object) => {
            if ((object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments) && object.name != "Earth globe" && object.type != "AxesHelper" && object.name == id) {
                countryParts.push(object);
            }
        });

        return countryParts;
    }

    function render() {

        camera.updateMatrixWorld();

        raycasterCountries.setFromCamera(mouse, camera);

        var countryIntersected;
        var countryParts;

        // Perform raycasting and check for intersections
        // endGame
        if (!endGame && !(isMobile)) {  // Only check intersections if the cube exists

            //raycasterCountries.update(camera, mouse);

            const intersects = raycasterCountries.intersectObjects(getSceneCountries(), false);

            if (intersects.length > 0) {


                const worldPos = intersects[0].point;
                if (intersected != intersects[0].object) {

                    if (intersected) {

                        intersected.material.color = originalColor;
                        intersected.position.copy(originCoordinates);
                        intersected.parent.children[intersected.parent.children.length - 1].position.copy(originCoordinates);


                        countryParts = lookForCountryParts(intersected.name);

                        // Modify countryParts
                        if (countryParts) {

                            countryParts.forEach((object) => {
                                if ((object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) {
                                    object.material.color = originalColor;
                                    object.parent.children[intersected.parent.children.length - 1].position.copy(originCoordinates);
                                }
                            });

                        }
                        if (wrongCountriesSelected.includes(intersected.name)) {

                            intersects[0].object.material.color = redColor;
                            intersects[0].object.position.copy(originCoordinates);
                            intersects[0].object.parent.children[intersected.parent.children.length - 1].position.copy(originCoordinates);


                            var countryParts = lookForCountryParts(intersected.name);

                            // Modify countryParts
                            if (countryParts) {

                                countryParts.forEach((object) => {
                                    if ((object instanceof THREE.Mesh)) {
                                        object.material.color = redColor;
                                        object.parent.children[object.parent.children.length - 1].position.copy(originCoordinates);
                                    }
                                });
                            }

                        }

                        countryIntersected = null;
                        countryParts = [];
                    }

                    if (!CountrySelected.includes(intersects[0].object.name)) {

                        intersected = intersects[0].object;
                        intersected.material.color = hoverColor;

                        // Now you can set the position of the mesh to the local position
                        intersected.position.copy(transformPositionWithMagnitud(worldPos, intersected.matrixWorld));

                        const homonimObject = intersected.parent.children;

                        homonimObject[homonimObject.length - 1].position.copy(transformPositionWithMagnitud(worldPos, intersected.matrixWorld));


                        countryParts = lookForCountryParts(intersected.name);

                        // Modify countryparts
                        if (countryParts) {
                            countryParts.forEach((object) => {
                                if ((object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) {
                                    object.material.color = hoverColor;
                                    // Now you can set the position of the mesh to the local position
                                    object.position.copy(transformPositionWithMagnitud(worldPos, intersected.matrixWorld));
                                }
                            });
                        }

                    }

                    if (wrongCountriesSelected.includes(intersects[0].object.name)) {

                        intersects[0].object.material.color = redColor;
                        intersects[0].object.position.copy(originCoordinates);
                        intersects[0].object.parent.children[intersects[0].object.parent.children.length - 1].position.copy(originCoordinates);


                        var countryParts = lookForCountryParts(intersects[0].object.name);

                        // Modify countryParts
                        if (countryParts) {

                            countryParts.forEach((object) => {
                                if ((object instanceof THREE.Mesh)) {
                                    object.material.color = redColor;
                                    object.parent.children[object.parent.children.length - 1].position.copy(originCoordinates);
                                }
                            });
                        }

                    }

                }

            } else {

                if (intersected) {

                    if (!CountrySelected.includes(intersected.name)) {

                        intersected.material.color = originalColor;
                        intersected.position.copy(originCoordinates);
                        intersected.parent.children[intersected.parent.children.length - 1].position.copy(originCoordinates);


                        countryParts = lookForCountryParts(intersected.name);

                        countryParts.forEach((object) => {
                            if ((object instanceof THREE.Mesh) && !(object instanceof THREE.LineSegments)) {
                                object.material.color = originalColor;
                                // Now you can set the position of the mesh to the local position
                                object.parent.children[object.parent.children.length - 1].position.copy(originCoordinates);
                            }
                        });

                    }


                    if (wrongCountriesSelected.includes(intersected.name)) {

                        intersected.material.color = redColor;
                        intersected.position.copy(originCoordinates);
                        intersected.parent.children[intersected.parent.children.length - 1].position.copy(originCoordinates);


                        var countryParts = lookForCountryParts(intersected.name);

                        // Modify countryParts
                        if (countryParts) {

                            countryParts.forEach((object) => {
                                if ((object instanceof THREE.Mesh)) {
                                    object.material.color = redColor;
                                    object.parent.children[object.parent.children.length - 1].position.copy(originCoordinates);
                                }
                            });
                        }

                    }

                }

                intersected = null;
                countryParts = [];

            }
        }

        renderer.render(scene, camera);

    }

    function animate() {

        controls.update();


        if (pointerModel) {
            quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0).normalize(), 0.005); // Rotate around Y axis
            pointerModel.quaternion.multiply(quaternion); // Apply the rotation
        }

        if (earth) {

        }

        render();
    }

    renderer.setAnimationLoop(animate);

    function getSceneCountries() {

        const objectsToRaycast = [];
        scene.traverse((object) => {
            if ((object instanceof THREE.Mesh) && object.name != "Earth globe" && object.type != "AxesHelper") {
                objectsToRaycast.push(object);
            }
        });

        return objectsToRaycast;
    }

    //Dynamically highlight the correct answers
    function markQuizQuestions(selectedId) {

        //const questions = document.getElementById('questions');
        CountrySelected.forEach((country, index) => {
            if (country == selectedId) {
                // DEBUG console.log("Solutions", solutions);
                solutions.forEach((solution) => {
                    if (solution == selectedId && solution == country) {
                        var idx = solutions.indexOf(solution);
                        const q = document.getElementById('q' + idx);
                        q.className = 'p-2 text-1xl rounded-lg m-2 bg-green-500 justify-items-center';
                    }
                })
            } else {
                // DEBUG console.log("break");
            }
        });

    }

    function markWrongQuizQuestions() {

        //const questions = document.getElementById('questions');
        solutions.forEach((solution, index) => {
            if (CountrySelected.includes(solution)) {
                // DEBUG console.log("No pintar");
            } else {
                const q = document.getElementById('q'+index);
                q.className = 'p-2 text-1xl rounded-lg m-2 bg-customorange justify-items-center';
            }
        });

    }

    function showAnswers() {

        try {
            //const questions = document.getElementById('questions');
            questions.forEach((question, index) => {
                const q = document.getElementById('q'+index);
                const res = document.createElement('div');
                res.innerHTML = indicesMap[question[[2]]];
                res.className = 'items-center mt-1 mb-1 p-1 rounded-lg border-1 bg-gray-50';
                q.append(res);
                // DEBUG console.log(respuesta, q);
            });

        } catch (error) {
            console.error("Error drawing results", error);
        }
        
    }

    function showResults(aciertos, total) {
        const results = document.getElementById("results");
        // DEBUG console.log(results);
        results.style.visibility = 'visible';
        results.innerHTML = `Results: ${aciertos} hits out of ${total}`
    }



    // Event functions
    //@params: event

    function onMouseDown(event) {

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

    }

    function onMouseUp(event) {

        if (!isDragging) {

            onMouseClick(event)

        }

        isDragging = false; // Reset the dragging state
    }


    function onMouseClick(event) {

        //event.preventDefault();

        //mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        //mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / (rect.right - rect.left)) * 2 - 1;
        mouse.y = - ((event.clientY - rect.top) / (rect.bottom - rect.top)) * 2 + 1;

        //console.log("Pointer clicked, coordinates: ", pointer.x, pointer.y);

        if (event.button == 0 && !endGame) {

            //Set raycaster position
            raycaster.setFromCamera(mouse, camera);

            var intersects = raycaster.intersectObjects(getSceneCountries(), false);
            // DEBUG console.log("right click", intersects);

            if (intersects.length > 0) {

                const clicked = intersects[0].object;
                // DEBUG console.log(clicked.name);

                // DEBUG console.log(clicked.name);
                // DEBUG console.log(solutions);

                // Logic if country is in the solutions
                if (solutions.includes(clicked.name)) {

                    if (!CountrySelected.includes(clicked.name)) {


                        CountrySelected.push(clicked.name);

                    }

                    if (!endGame) {

                        // DEBUG console.log("Dynamically change quiz");
                        markQuizQuestions(clicked.name);

                        // DEBUG console.log(clicked);
                        clicked.material.color = selectedColor;
                        clicked.position.copy(originCoordinates);
                        // CHECK clicked.parent.children[intersected.parent.children.length - 1].position.copy(originCoordinates);

                    }

                    if ([...solutions].sort().toString() == [...CountrySelected].sort().toString()) {

                        // DEBUG console.log("Aciertos %", CountrySelected.length / solutions.length);

                        showAnswers();
                        showResults(CountrySelected.length, solutions.length);

                        endGame = true;
                    }

                    var countryParts = lookForCountryParts(clicked.name);

                    // Modify countryParts
                    if (countryParts) {

                        countryParts.forEach((object) => {
                            if ((object instanceof THREE.Mesh)) {
                                object.material.color = selectedColor;
                                object.parent.children[clicked.parent.children.length - 1].position.copy(originCoordinates);
                            }
                        });
                    }



                } else {

                    wrongCountriesSelected.push(clicked.name);
                    triesCount -= 1;

                    if (triesCount > 0) {

                        // DEBUG console.log("TRIES COUNT", triesCount);
                        drawTries();

                    } else if (triesCount == 0) {

                        endGame = true;
                        // DEBUG console.log("TRIES COUNT", triesCount);
                        drawTries();
                        markWrongQuizQuestions();

                        // DEBUGconsole.log(solutions.length, CountrySelected.length)
                        // DEBUG console.log("Aciertos %", CountrySelected.length / solutions.length);
                        showResults(CountrySelected.length, solutions.length);
                        // DEBUG console.log("Sin más oportunidades");
                        showAnswers();

                        //Draw wrong selection
                        solutions.forEach(countryId => {
                            scene.traverse((object) => {
                                if ((object instanceof THREE.Mesh && object.name == countryId && !CountrySelected.includes(countryId))) {
                                    // DEBUG console.log("Draw");
                                    object.material.color = yellowColor;
                                }
                            });

                        });


                    }

                    clicked.material.color = redColor;
                    clicked.position.copy(originCoordinates);
                    clicked.parent.children[clicked.parent.children.length - 1].position.copy(originCoordinates);


                    var countryParts = lookForCountryParts(clicked.name);

                    // Modify countryParts
                    if (countryParts) {

                        countryParts.forEach((object) => {
                            if ((object instanceof THREE.Mesh)) {
                                object.material.color = redColor;
                                object.parent.children[clicked.parent.children.length - 1].position.copy(originCoordinates);
                            }
                        });
                    }


                }

                // DEBUG console.log(clicked);

                renderer.render(scene, camera);

                controls.update();

            }
        }

    }

    function transformPositionWithMagnitud(worldPos, matrix, magnitud = 0.004) {

        // Create a new Matrix4 to store the inverse matrix
        const inverseMatrix = new THREE.Matrix4();

        // Get the inverse of the world matrix
        inverseMatrix.copy(matrix).invert();

        const localPos = worldPos.clone().applyMatrix4(inverseMatrix);
        return localPos.multiplyScalar(magnitud)

    }

    //Events
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);

    // Handle window resize
    window.addEventListener('resize', () => {
        var scopeCanvas = document.getElementById("main_container");
        const width = 0.75 * scopeCanvas.offsetWidth;
        const height = scopeCanvas.offsetHeight;

        renderer.setSize(width, height);



        if (container.clientWidth > 768) {
            const width = 0.75 * scopeCanvas.offsetWidth;
            const height = scopeCanvas.offsetHeight;
            renderer.setSize(width, height);
        } else {
            renderer.setSize(container.clientWidth, container.clientHeight);
        }
        camera.updateProjectionMatrix();
        camera.aspect = width / height;


    }), false;

    window.mobileCheck = function() {
        isMobile = (function(a){
        if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator.userAgent||navigator.vendor||window.opera);
        return check;
      };


    // GUI
    const gui = new GUI({ container: document.getElementById('gui-container') });

    const params = {
        wireframe: false,
    }

    const visualFolder = gui.addFolder('Visual');
    visualFolder.add(params, 'wireframe').name('Draw countries').onChange((value) => {
        globalConstantWireframe = value;
        // DEBUG console.log(value);
        scene.traverse((object) => {
            if ((object instanceof THREE.LineSegments)) {
                object.visible = value;
            }
        });
    });

    visualFolder.open()

}

// IMPORTANT FORMER FUNCTION
function generateCountryGeometry(delaunayPointsIn3D, triangles, thickness = 0.004) {

    //console.log(delaunayPointsIn3D);

    // Step 1: Validate and sanitize points
    const validPoints = [];
    delaunayPointsIn3D.forEach(p => {
        if (!Array.isArray(p) || p.length != 3) {
            //console.warn(`Invalid 3D point at index ${i}: ${JSON.stringify(p)}. Replacing with [0, 0, 0].`);
            validPoints.push([0, 0, 0]); // Default to origin for invalid points
        } else {
            const magnitude = Math.sqrt(p[0] * p[0] + p[1] * p[1] + p[2] * p[2]);
            const scale = (magnitude + thickness) / magnitude;
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

    /*     console.log("POSITIONS", positions.length); // returns 3738
        console.log("INDICES", indices.length); // returns 3009
     */

    // Convert triangles to flat array of indices
    const myIndices = new Uint32Array(validTriangles.flat());
    geometry.setIndex(new THREE.BufferAttribute(myIndices, 1));

    geometry.computeVertexNormals();  // Compute normals for the faces

    //DEBUG console.log("INDEX", geometry.index.array.constructor.name);

    // Wireframe
    var geo = new THREE.EdgesGeometry(geometry, 30); // or WireframeGeometry
    var mat = new THREE.LineBasicMaterial({ color: 0x000000 });
    var wireframe = new THREE.LineSegments(geo, mat);
    //scene.add(wireframe)

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

    // Check if poly2tri is loaded
    if (typeof poly2tri !== 'undefined') {
        //console.log('poly2tri is loaded!');
    } else {
        //console.log('poly2tri is NOT loaded!');
    }


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

function generateMeshPointsIn3D(array) {


    // Constraint in pol2tri for not repeating points, in array last == first
    //const polyPoints = array.slice(0, -1);

    var delaunayPointsIn3D = []

    array.forEach(function (p) {

        var point = latLonTo3DSphere(p[0], p[1]);
        //console.log("point", point);
        if (point.x == null || point.y == null || point.z == null) {
            // DEBUG console.log("Point Delaunay coordinate equal 0");
        } else {
            delaunayPointsIn3D.push([point.x, point.y, point.z]);
        }



    });

    return delaunayPointsIn3D;

}

function generateMeshAndWireframe(array, triangles, countryId) {


    const meshPointsIn3D = generateMeshPointsIn3D(array);

    // ------- IMPORTANTconsole.log(getGenerateCountryGeometryAndEdgeGeometryFromPoints(array));
    const geometryAndEdges = generateCountryGeometry(meshPointsIn3D, triangles);

    // Generate geometry from the points
    const g = geometryAndEdges.geometry;

    const m = new THREE.MeshToonMaterial({
        color: originalColor,
        side: THREE.DoubleSide,
    });

    const groupCountryAndWireframe = new THREE.Group();
    groupCountryAndWireframe.name = "groupCountryAndWireframe";

    // solid mesh
    var mesh = new THREE.Mesh(g, m);
    // --------- IMPORTANT 
    mesh.name = countryId;
    groupCountryAndWireframe.add(mesh);

    // Create the edges material
    const edgeMesh = geometryAndEdges.wireframe;
    edgeMesh.visible = false;

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

// Intial loader configuration
// Create a Loading manager
let assetsLoaded = false;
let countriesNotLoaded = 0;

let isSceneInitialized = false;
const loadingManager = new THREE.LoadingManager();


loadingManager.onStart = function (url, itemsLoaded, itemsTotal) {
    // DEBUG console.log("Loading started...");
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'flex';
    // DEBUG console.log(`Started loading ${url}. ${itemsLoaded}/${itemsTotal} items.`);
}

loadingManager.onProgress = (url, itemsLoaded, itemsTotal, progressEvent) => {

    const progressPercentage = (itemsLoaded / itemsTotal) * 100;

    // DEBUG console.log(`Progress: ${url} loaded. ${itemsLoaded}/${itemsTotal} items.`);

};

loadingManager.onLoad = function () {

    // DEBUG console.log("All resources and tasks completed!");
    // DEBUG console.log("Hiding loader after delay...");
    // DEBUG console.log("isSceneInitialized before check:", isSceneInitialized);
    const loader = document.getElementById('loader');
    if (loader) loader.style.display = 'none';

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
/* const GLTFloader = new GLTFLoader(loadingManager); */
/* const loaderSVG = new SVGLoader(loadingManager);
const textureLoader = new THREE.TextureLoader(loadingManager); */

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

function generateExtraCountryGeometry(pointsArray, delaunayPointsIn3D, thickness = 0.004) {


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
    //const indices = [];  // Array to store triangle indices

    // Add all points (outer followed by inner) to positions
    //const pointToIndex = new Map();
    /*     outerPoints.forEach((point, index) => {
            const magnitude = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
            const scale = (magnitude + thickness) / magnitude;
            positions.push(point.x * scale, point.y * scale, point.z * scale);
            pointToIndex.set(index, index); // Map original index to position index
        });
        innerPoints.forEach((point, index) => {
            const magnitude = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
            const scale = (magnitude + thickness) / magnitude;
            positions.push(point.x * scale, point.y * scale, point.z * scale);
            pointToIndex.set(index + numOuterPoints, index + numOuterPoints);
        }); */

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

    geometry.computeVertexNormals(); // Compute normals for lighting

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
    const m = new THREE.MeshToonMaterial({
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
    wireframe.visible = false;

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

