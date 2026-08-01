// frontend/js/ui/components.js
// Gerenciador de componentes UI

class UIComponents {
    constructor() {
        this.init();
    }

    init() {
        this.initFilterBoxes();
    }

    // ============================================
    // ALERT BOXES
    // ============================================

    showAlert(type, title, message, duration = 5000) {
        const container = document.getElementById('alertContainer');
        if (!container) {
            this.createAlertContainer();
        }
        
        const alertId = 'alert_' + Date.now();
        const alertHtml = `
            <div id="${alertId}" class="alert-box box-${type} slide-in">
                <div class="alert-icon">
                    <i data-lucide="${this.getAlertIcon(type)}"></i>
                </div>
                <div class="alert-content">
                    ${title ? `<h4>${title}</h4>` : ''}
                    ${message ? `<p>${message}</p>` : ''}
                </div>
                <button class="alert-close" onclick="uiComponents.closeAlert('${alertId}')">
                    <i data-lucide="x"></i>
                </button>
            </div>
        `;
        
        const alertContainer = document.getElementById('alertContainer');
        alertContainer.insertAdjacentHTML('beforeend', alertHtml);
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        if (duration > 0) {
            setTimeout(() => {
                this.closeAlert(alertId);
            }, duration);
        }
        
        return alertId;
    }

    getAlertIcon(type) {
        const icons = {
            success: 'check-circle',
            danger: 'alert-circle',
            warning: 'alert-triangle',
            primary: 'info',
            info: 'info'
        };
        return icons[type] || 'bell';
    }

    closeAlert(alertId) {
        const alert = document.getElementById(alertId);
        if (alert) {
            alert.style.animation = 'slideInDown 0.3s reverse';
            setTimeout(() => alert.remove(), 300);
        }
    }

    createAlertContainer() {
        const container = document.createElement('div');
        container.id = 'alertContainer';
        container.style.position = 'fixed';
        container.style.top = '20px';
        container.style.right = '20px';
        container.style.zIndex = '10000';
        container.style.maxWidth = '400px';
        document.body.appendChild(container);
    }

    // ============================================
    // BADGES
    // ============================================

    createBadge(type, text, size = 'medium') {
        const badge = document.createElement('span');
        badge.className = `badge-indicator ${type} ${size}`;
        badge.textContent = text;
        return badge;
    }

    // ============================================
    // INTERACTIVE CARDS
    // ============================================

    createInteractiveCard(config) {
        const card = document.createElement('div');
        card.className = `interactive-card ${config.selected ? 'interactive-card--selected' : ''}`;
        card.onclick = config.onClick;
        
        card.innerHTML = `
            ${config.icon ? `
            <div class="card-icon">
                <i data-lucide="${config.icon}"></i>
            </div>
            ` : ''}
            <div class="card-content">
                <h3>${config.title}</h3>
                <p>${config.description || ''}</p>
            </div>
            ${config.badge ? `
            <div class="card-badge">
                ${config.badge}
            </div>
            ` : ''}
            ${config.action ? `
            <div class="card-action">
                ${config.action}
            </div>
            ` : ''}
        `;
        
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        return card;
    }

    // ============================================
    // RECORDS BOARD
    // ============================================

    createRecordsBoard(title, records, columns = 1) {
        const board = document.createElement('div');
        board.className = 'records-board';
        
        let boardHtml = `
            <div class="board-title">
                <span>${title}</span>
            </div>
            <div class="board board-col-${columns}">
        `;
        
        records.forEach(record => {
            boardHtml += `
                <div class="info-row">
                    <span class="title">${record.label}</span>
                    <span class="value">${record.value}</span>
                </div>
            `;
        });
        
        boardHtml += `</div>`;
        board.innerHTML = boardHtml;
        
        return board;
    }

    // ============================================
    // FILTERS
    // ============================================

    initFilterBoxes() {
        document.querySelectorAll('.filter-applied').forEach(filter => {
            filter.addEventListener('click', (e) => {
                if (e.target.tagName !== 'BUTTON') {
                    this.toggleFilterOptions(filter);
                }
            });
        });
    }

    toggleFilterOptions(filterElement) {
        const options = filterElement.querySelector('.filter-options');
        if (options) {
            options.classList.toggle('show');
        }
    }

    addFilter(label, onRemove) {
        const container = document.getElementById('filtersContainer');
        if (!container) return;
        
        const filterId = 'filter_' + Date.now();
        const filterHtml = `
            <div id="${filterId}" class="filter-applied-box-options">
                <div class="filter-applied-options">
                    <strong>${label}</strong>
                    <button onclick="uiComponents.removeFilter('${filterId}', ${onRemove})">
                        <i data-lucide="x"></i>
                    </button>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', filterHtml);
        if (typeof lucide !== 'undefined') lucide.createIcons();
        
        return filterId;
    }

    removeFilter(filterId, callback) {
        const filter = document.getElementById(filterId);
        if (filter) {
            filter.remove();
            if (callback) callback();
        }
    }

    clearAllFilters() {
        const container = document.getElementById('filtersContainer');
        if (container) {
            container.innerHTML = '';
        }
    }
}

// ============================================
// INICIALIZAR
// ============================================

let uiComponents = null;

document.addEventListener('DOMContentLoaded', () => {
    uiComponents = new UIComponents();
    window.uiComponents = uiComponents;
    console.log('✅ UI Components inicializado');
});

// Exportar
window.UIComponents = UIComponents;