// Theme Management
(function () {
    function init() {
        try {
            // 1. Initialize Theme
            const savedTheme = localStorage.getItem('theme') || 'light';
            document.body.setAttribute('data-theme', savedTheme);

            // 2. Find Toggle Button and Logo
            const toggleBtn = document.getElementById('theme-toggle');
            const logoImg = document.querySelector('.brand-logo img');

            function updateLogo(theme) {
                if (!logoImg) return;
                const currentSrc = logoImg.getAttribute('src');
                const isToolsPage = currentSrc.includes('../');
                const basePath = isToolsPage ? '../assets/' : 'assets/';
                logoImg.src = theme === 'dark' ? basePath + 'icon_dark.png' : basePath + 'icon_light.png';
            }

            // Set initial logo
            updateLogo(savedTheme);

            if (toggleBtn) {
                // 3. Set Initial Icon
                const icon = toggleBtn.querySelector('.icon');
                if (icon) {
                    icon.textContent = savedTheme === 'dark' ? '🌙' : '☀️';
                }

                // 4. Attach Click Listener
                toggleBtn.onclick = function (e) {
                    e.preventDefault();

                    const currentTheme = document.body.getAttribute('data-theme');
                    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

                    document.body.setAttribute('data-theme', newTheme);
                    localStorage.setItem('theme', newTheme);

                    updateLogo(newTheme);

                    if (icon) {
                        icon.textContent = newTheme === 'dark' ? '🌙' : '☀️';
                    }
                };
            }
        } catch (e) {
            console.error("Theme initialization error:", e);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
