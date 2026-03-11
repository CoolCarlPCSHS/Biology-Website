// Food items with properties
const FOOD_ITEMS = [
    { name: 'Lettuce', herbivorous: true, waterSoluble: true },
    { name: 'Carrot', herbivorous: true, waterSoluble: true },
    { name: 'Apple', herbivorous: true, waterSoluble: true },
    { name: 'Spinach', herbivorous: true, waterSoluble: true },
    { name: 'Avocado', herbivorous: true, waterSoluble: false },
    { name: 'Nuts', herbivorous: true, waterSoluble: false },
    { name: 'Beef', herbivorous: false, waterSoluble: true },
    { name: 'Chicken', herbivorous: false, waterSoluble: true },
    { name: 'Fish', herbivorous: false, waterSoluble: false },
    { name: 'Pork', herbivorous: false, waterSoluble: true }
];

let draggedItem = null;
let draggedItemData = null;
let draggedStationType = null;
const playground = document.getElementById('playground');
const stations = [];

// Create food inventory items
function initFoodInventory() {
    const container = document.getElementById('food-items-container');
    FOOD_ITEMS.forEach(food => {
        const item = document.createElement('div');
        item.className = 'inventory-item';
        item.draggable = true;
        item.textContent = food.name;
        item.dataset.name = food.name;
        item.dataset.herbivorous = food.herbivorous;
        item.dataset.waterSoluble = food.waterSoluble;
        
        item.addEventListener('dragstart', (e) => {
            draggedItem = 'food';
            draggedItemData = { ...food };
            e.dataTransfer.effectAllowed = 'copy';
        });
        
        container.appendChild(item);
    });
}

// Station drag handlers
function initStationInventory() {
    const stationTemplates = document.querySelectorAll('.station-template');
    stationTemplates.forEach(template => {
        template.addEventListener('dragstart', (e) => {
            draggedItem = 'station';
            draggedStationType = template.dataset.station;
            e.dataTransfer.effectAllowed = 'copy';
        });
    });
}

// Station 1: Herbivorous check
function checkStation1(element, data, elemRect) {
    for (let station of stations) {
        if (station.dataset.type !== 'station1') continue;
        
        const stationRect = station.getBoundingClientRect();
        const overlaps = !(elemRect.right < stationRect.left || 
                          elemRect.left > stationRect.right || 
                          elemRect.bottom < stationRect.top || 
                          elemRect.top > stationRect.bottom);
        
        if (overlaps) {
            if (data.herbivorous) {
                console.log(`${data.name} passed Station 1 (Herbivorous)`);
                station.style.borderColor = '#00ff00';
                setTimeout(() => station.style.borderColor = '#8B4513', 300);
                element.style.backgroundColor = '#4CAF50';
                return true;
            } else {
                console.log(`${data.name} rejected at Station 1 (Not Herbivorous)`);
                station.style.borderColor = '#ff0000';
                setTimeout(() => station.style.borderColor = '#8B4513', 300);
                element.style.backgroundColor = '#f44336';
                return false;
            }
        }
    }
    return null;
}

// Station 2: Solubility check with partition
function checkStation2(element, data, elemRect, physics) {
    for (let station of stations) {
        if (station.dataset.type !== 'station2') continue;
        
        const stationRect = station.getBoundingClientRect();
        const playRect = playground.getBoundingClientRect();
        
        const overlaps = !(elemRect.right < stationRect.left || 
                          elemRect.left > stationRect.right || 
                          elemRect.bottom < stationRect.top || 
                          elemRect.top > stationRect.bottom);
        
        if (overlaps) {
            station.style.borderColor = '#00ff00';
            setTimeout(() => station.style.borderColor = '#4169E1', 300);
            
            const stationCenterX = (stationRect.left + stationRect.right) / 2 - playRect.left;
            const itemCenterX = physics.x + 20; // 20 is half of 40px diameter
            
            // Apply force based on solubility
            if (data.waterSoluble) {
                // Water-soluble: force to RIGHT side
                console.log(`${data.name} is Water-Soluble - forcing RIGHT`);
                element.style.backgroundColor = '#2196F3';
                if (itemCenterX < stationCenterX) {
                    physics.forceX = 2; // Push right
                }
            } else {
                // Fat-soluble: force to LEFT side
                console.log(`${data.name} is Fat-Soluble - forcing LEFT`);
                element.style.backgroundColor = '#FF9800';
                if (itemCenterX > stationCenterX) {
                    physics.forceX = -2; // Push left
                }
            }
            return true;
        }
    }
    return null;
}

// Playground drag events
playground.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
});

playground.addEventListener('drop', (e) => {
    e.preventDefault();
    
    const rect = playground.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (draggedItem === 'station') {
        createStation(draggedStationType, x, y);
        draggedItem = null;
        draggedStationType = null;
    } else if (draggedItem === 'food' && draggedItemData) {
        createFoodItem(draggedItemData, x, y);
        draggedItem = null;
        draggedItemData = null;
    }
});

// Create station in playground
function createStation(type, x, y) {
    const station = document.createElement('div');
    station.className = `station ${type}`;
    station.style.left = x + 'px';
    station.style.top = y + 'px';
    
    if (type === 'station1') {
        station.innerHTML = '<h4>Station 1: Mouth</h4><p>Herbivorous Only</p>';
        station.dataset.type = 'station1';
    } else if (type === 'station2') {
        station.innerHTML = `
            <h4>Station 2: Stomach</h4>
            <p>Solubility Sort</p>
            <div class="partition"></div>
            <div class="side-label left-label">Fat-Soluble</div>
            <div class="side-label right-label">Water-Soluble</div>
        `;
        station.dataset.type = 'station2';
    }
    
    playground.appendChild(station);
    stations.push(station);
}

// Create food item in playground
function createFoodItem(data, x, y) {
    const element = document.createElement('div');
    element.className = 'dropped-item';
    element.textContent = data.name;
    element.style.left = x + 'px';
    element.style.top = y + 'px';
    element.dataset.name = data.name;
    element.dataset.herbivorous = data.herbivorous;
    element.dataset.waterSoluble = data.waterSoluble;
    
    playground.appendChild(element);
    applyPhysics(element, data);
}

// Physics with rolling and station checks
function applyPhysics(element, data) {
    const physics = {
        x: parseFloat(element.style.left),
        y: parseFloat(element.style.top),
        velocityX: 0,
        velocityY: 0,
        rotation: 0,
        forceX: 0,
        gravity: 0.5,
        bounceDamping: 0.6,
        friction: 0.98,
        angularVelocity: 0
    };
    
    const radius = 20; // Half of 40px
    const playgroundHeight = playground.offsetHeight;
    const playgroundWidth = playground.offsetWidth;
    
    let passedStation1 = false;
    let checkedStation1 = false;
    let checkedStation2 = false;
    let rejected = false;
    
    function update() {
        if (rejected) return;
        
        // Apply forces
        physics.velocityX += physics.forceX;
        physics.forceX *= 0.9; // Gradual force decay
        
        // Apply gravity
        physics.velocityY += physics.gravity;
        
        // Apply friction when on ground
        const onGround = physics.y + radius * 2 >= playgroundHeight - 5;
        if (onGround) {
            physics.velocityX *= physics.friction;
        }
        
        // Update position
        physics.x += physics.velocityX;
        physics.y += physics.velocityY;
        
        // Update rotation based on horizontal movement (rolling)
        physics.angularVelocity = physics.velocityX * 2;
        physics.rotation += physics.angularVelocity;
        
        // Apply position and rotation
        element.style.left = physics.x + 'px';
        element.style.top = physics.y + 'px';
        element.style.transform = `rotate(${physics.rotation}deg)`;
        
        // Get current bounding rect for collision checks
        const elemRect = element.getBoundingClientRect();
        
        // Check Station 1
        if (!checkedStation1) {
            const result1 = checkStation1(element, data, elemRect);
            if (result1 !== null) {
                checkedStation1 = true;
                if (result1 === false) {
                    rejected = true;
                    setTimeout(() => {
                        element.style.transition = 'opacity 0.5s';
                        element.style.opacity = '0';
                        setTimeout(() => element.remove(), 500);
                    }, 1000);
                    return;
                } else {
                    passedStation1 = true;
                }
            }
        }
        
        // Check Station 2 (only if passed Station 1)
        if (passedStation1 && !checkedStation2) {
            const result2 = checkStation2(element, data, elemRect, physics);
            if (result2 !== null) {
                checkedStation2 = true;
            }
        }
        
        // Wall collisions with bounce
        if (physics.x < 0) {
            physics.x = 0;
            physics.velocityX = -physics.velocityX * physics.bounceDamping;
        }
        if (physics.x + radius * 2 > playgroundWidth) {
            physics.x = playgroundWidth - radius * 2;
            physics.velocityX = -physics.velocityX * physics.bounceDamping;
        }
        
        // Ground collision with bounce
        if (physics.y + radius * 2 >= playgroundHeight) {
            physics.y = playgroundHeight - radius * 2;
            physics.velocityY = -physics.velocityY * physics.bounceDamping;
            
            // Stop bouncing if velocity is too small
            if (Math.abs(physics.velocityY) < 0.5) {
                physics.velocityY = 0;
            }
        }
        
        // Ceiling collision
        if (physics.y < 0) {
            physics.y = 0;
            physics.velocityY = -physics.velocityY * physics.bounceDamping;
        }
        
        // Continue animation if still moving or falling
        if (Math.abs(physics.velocityX) > 0.1 || 
            Math.abs(physics.velocityY) > 0.1 || 
            physics.y + radius * 2 < playgroundHeight - 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

// Initialize on load
window.addEventListener('DOMContentLoaded', () => {
    initFoodInventory();
    initStationInventory();
});
