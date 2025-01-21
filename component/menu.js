class MenuComponent extends HTMLElement {
  connectedCallback() {
    this.innerHTML = `
        <style>
            /* Header Style */
            header {
                background: linear-gradient(to right, #003399, #3366cc);
                color: white;
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                position: fixed;
                top: 0;
                width: 100%;
                z-index: 1000;
            }

            /* Navbar */
            .navbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 20px;
                max-width: 1200px;
                margin: 0 auto;
            }

            /* Logo */
            .navbar-brand {
                font-size: 20px;
                font-weight: 700;
                color: #ffd700; /* สีเหลือง */
                text-transform: uppercase;
                display: flex;
                align-items: center;
            }

            .navbar-brand span {
                margin-left: 8px;
                color: white; /* สีขาวของคำว่า INDO Smile */
            }

            /* Navbar Links */
            .navbar-nav {
                display: flex; /* ปรับเป็น Flexbox */
                list-style: none;
                margin: 0;
                padding: 0;
                flex-direction: row;
            }

            .nav-item {
                margin-left: 30px; /* เว้นระยะระหว่างแต่ละเมนู */
            }

            .nav-link {
                font-size: 16px;
                font-weight: 500;
                color: white;
                text-decoration: none;
                padding: 5px 10px;
                position: relative;
                transition: all 0.3s ease-in-out;
            }

            /* Hover Animation */
            .nav-link:hover {
                color: #ffd700;
            }

            .nav-link::after {
                content: '';
                position: absolute;
                bottom: 0;
                left: 50%;
                width: 0;
                height: 2px;
                background-color: #ffd700;
                transition: all 0.3s ease-in-out;
                transform: translateX(-50%);
            }

            .nav-link:hover::after {
                width: 100%;
            }

            /* Mobile Menu Button */
            .navbar-toggler {
                background: none;
                border: none;
                color: white;
                font-size: 24px;
                cursor: pointer;
                display: none;
            }

            /* Responsive */
            @media (max-width: 768px) {
                .navbar-nav {
                    flex-direction: column; /* เปลี่ยนเป็นแนวตั้ง */
                    display: none;
                    width: 100%;
                    background: #003399;
                    position: absolute;
                    top: 60px;
                    left: 0;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                }

                .navbar-nav.active {
                    display: flex;
                }

                .nav-item {
                    margin: 10px 0;
                    text-align: center;
                }

                .navbar-toggler {
                    display: inline-block;
                }
            }
        </style>
        <header>
            <nav class="navbar">
                <!-- Logo -->
                <a class="navbar-brand" href="/index.html">
                    Booking <span>INDO Smile</span>
                </a>

                <!-- Menu Items -->
                <ul class="navbar-nav">
                    <li class="nav-item">
                        <a class="nav-link" href="/index.html">Add Booking</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/frontend/main/view.html">View Bookings</a>
                    </li>
                                                            <li class="nav-item">
                        <a class="nav-link" href="/frontend/order/viewOrder.html">View Order</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/frontend/main/calendar.html">Calendar</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link" href="/frontend/main/payments.html">Payments</a>
                    </li>

                </ul>

                <!-- Toggler Button for Mobile -->
                <button class="navbar-toggler" id="menu-toggler">
                    <span>&#9776;</span>
                </button>
            </nav>
        </header>
        `;

    // JavaScript for Mobile Menu Toggle
    const toggler = this.querySelector("#menu-toggler");
    const menu = this.querySelector(".navbar-nav");

    toggler.addEventListener("click", () => {
      menu.classList.toggle("active");
    });
  }
}

// Define the custom element
customElements.define("menu-component", MenuComponent);
