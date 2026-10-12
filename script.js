
"use strict";

// Get HTML elements
const searchForm = document.getElementById("searchForm");
const usernameInput = document.getElementById("username");
const statusBox = document.getElementById("status");
const profilesBox = document.getElementById("profiles");
const repositoriesBox = document.getElementById("repositories");

let requestNumber = 0;

// Format dates, e.g. 25 Jan 2023
function formatDate(dateString) {
  if (!dateString) return "Not available";

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

// Show loading, success, or error messages
function showStatus(message, type = "normal") {
  statusBox.replaceChildren();

  if (type === "loading") {
    const spinner = document.createElement("span");
    spinner.className = "loader";
    spinner.setAttribute("aria-hidden", "true");
    statusBox.appendChild(spinner);
  }

  const text = document.createElement("span");
  text.textContent = message;

  if (type === "error") {
    text.className = "error";
  }

  statusBox.appendChild(text);
}

// Fetch a GitHub profile
async function fetchUser(username) {
  const response = await fetch(
    `https://api.github.com/users/${encodeURIComponent(username)}`,
    {
      headers: {
        Accept: "application/vnd.github+json"
      }
    }
  );

  if (response.status === 404) {
    throw new Error("User Not Found — please check the username.");
  }

  if (response.status === 403) {
    throw new Error(
      "GitHub API rate limit exceeded. Please try again later."
    );
  }

  if (!response.ok) {
    throw new Error(`GitHub API error (${response.status}).`);
  }

  return response.json();
}

// Fetch and sort repositories by last update
async function fetchRepositories(reposUrl) {
  const response = await fetch(
    `${reposUrl}?sort=updated&direction=desc&per_page=5`,
    {
      headers: {
        Accept: "application/vnd.github+json"
      }
    }
  );

  if (response.status === 403) {
    throw new Error("GitHub API rate limit exceeded.");
  }

  if (!response.ok) {
    throw new Error("Could not load repositories.");
  }

  const repositories = await response.json();

  return repositories.sort(
    (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
  );
}

// Safely create an HTML element
function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined) {
    element.textContent = text;
  }

  return element;
}

// Safely create an external link
function createLink(text, url, className = "") {
  const link = createElement("a", className, text);

  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";

  return link;
}

// Validate portfolio URLs
function getPortfolioURL(blog) {
  if (!blog) return null;

  try {
    const url = new URL(
      /^https?:\/\//i.test(blog) ? blog : `https://${blog}`
    );

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

// Render the GitHub profile card
function renderProfile(user) {
  const card = createElement("article", "profile-card");
  const top = createElement("div", "profile-top");

  const avatar = createElement("img", "avatar");
  avatar.src = user.avatar_url;
  avatar.alt = `${user.login}'s avatar`;
  avatar.loading = "lazy";

  const heading = createElement("div");
  heading.appendChild(
    createElement("h2", "", user.name || user.login)
  );

  heading.appendChild(
    createLink(`@${user.login}`, user.html_url, "username-link")
  );

  top.append(avatar, heading);
  card.appendChild(top);

  card.appendChild(
    createElement("p", "bio", user.bio || "No bio available.")
  );

  const meta = createElement("div", "meta");

  meta.appendChild(
    createElement(
      "div",
      "",
      `Joined: ${formatDate(user.created_at)}`
    )
  );

  const portfolio = createElement("div");
  portfolio.appendChild(createElement("strong", "", "Portfolio: "));

  const portfolioURL = getPortfolioURL(user.blog);

  if (portfolioURL) {
    portfolio.appendChild(
      createLink("Visit website", portfolioURL)
    );
  } else {
    portfolio.appendChild(
      document.createTextNode("Not available")
    );
  }

  meta.appendChild(portfolio);

  meta.appendChild(
    createElement("div", "", `Public repositories: ${user.public_repos}`)
  );

  meta.appendChild(
    createElement("div", "", `Followers: ${user.followers}`)
  );

  card.appendChild(meta);

  profilesBox.appendChild(card);
}

// Render repository cards
function renderRepositories(user, repositories) {
  const section = createElement("section", "repo-section");

  section.appendChild(
    createElement("h2", "", `Latest Repositories — ${user.login}`)
  );

  const list = createElement("div", "repo-list");

  if (repositories.length === 0) {
    list.appendChild(
      createElement("p", "", "This user has no public repositories.")
    );
  }

  repositories.forEach(repo => {
    const item = createElement("article", "repo-item");

    item.appendChild(
      createLink(repo.name, repo.html_url, "repo-link")
    );

    item.appendChild(
      createElement(
        "p",
        "",
        repo.description || "No description available."
      )
    );

    item.appendChild(
      createElement(
        "div",
        "repo-info",
        `★ ${repo.stargazers_count} stars · Updated ${formatDate(repo.updated_at)}`
      )
    );

    list.appendChild(item);
  });

  section.appendChild(list);
  repositoriesBox.appendChild(section);
}

// Handle search submission
searchForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const username = usernameInput.value.trim();

  if (!username) {
    showStatus("Please enter a GitHub username.", "error");
    usernameInput.focus();
    return;
  }

  // Ignore results from older searches
  const currentRequest = ++requestNumber;

  const submitButton = searchForm.querySelector('button[type="submit"]');

  profilesBox.replaceChildren();
  repositoriesBox.replaceChildren();

  submitButton.disabled = true;
  showStatus("Loading GitHub profile...", "loading");

  try {
    // First API request: user profile
    const user = await fetchUser(username);

    if (currentRequest !== requestNumber) return;

    // Render profile even if repository loading later fails
    renderProfile(user);
    showStatus("Profile loaded successfully.");

    // Second API request: repositories
    try {
      const repositories = await fetchRepositories(user.repos_url);

      if (currentRequest !== requestNumber) return;

      renderRepositories(user, repositories);
    } catch (repoError) {
      if (currentRequest !== requestNumber) return;

      showStatus(
        `Profile loaded, but repositories could not be displayed: ${repoError.message}`,
        "error"
      );
    }
  } catch (error) {
    if (currentRequest !== requestNumber) return;

    profilesBox.replaceChildren();
    repositoriesBox.replaceChildren();

    showStatus(error.message, "error");
  } finally {
    if (currentRequest === requestNumber) {
      submitButton.disabled = false;
    }
  }
});

// Battle Mode elements
const battleToggle = document.getElementById("battleToggle");
const battleForm = document.getElementById("battleForm");
const userOneInput = document.getElementById("userOne");
const userTwoInput = document.getElementById("userTwo");

// Show or hide Battle Mode form
battleToggle.addEventListener("change", function () {
  battleForm.classList.toggle("hidden", !battleToggle.checked);

  if (battleToggle.checked) {
    userOneInput.focus();
  }
});

// Handle developer comparison
battleForm.addEventListener("submit", async function (event) {
  event.preventDefault();

  const usernameOne = userOneInput.value.trim();
  const usernameTwo = userTwoInput.value.trim();

  if (!usernameOne || !usernameTwo) {
    showStatus("Please enter both GitHub usernames.", "error");
    return;
  }

  if (usernameOne.toLowerCase() === usernameTwo.toLowerCase()) {
    showStatus("Please enter two different usernames.", "error");
    return;
  }

  const currentRequest = ++requestNumber;
  const compareButton = battleForm.querySelector('button[type="submit"]');

  profilesBox.replaceChildren();
  repositoriesBox.replaceChildren();

  compareButton.disabled = true;
  showStatus("Comparing developers...", "loading");

  try {
    const [userOne, userTwo] = await Promise.all([
      fetchUser(usernameOne),
      fetchUser(usernameTwo)
    ]);

    if (currentRequest !== requestNumber) return;

    // Display both developer profiles
    renderProfile(userOne);
    renderProfile(userTwo);

    // Display comparison results
    const comparison = document.createElement("section");
    comparison.className = "battle-results";

    const heading = document.createElement("h2");
    heading.textContent = "Developer Battle ⚔️";
    comparison.appendChild(heading);

    const metrics = [
      {
        label: "Followers",
        first: userOne.followers,
        second: userTwo.followers
      },
      {
        label: "Public Repositories",
        first: userOne.public_repos,
        second: userTwo.public_repos
      },
      {
        label: "Following",
        first: userOne.following,
        second: userTwo.following
      }
    ];

    metrics.forEach(metric => {
      const row = document.createElement("div");
      row.className = "battle-row";

      const first = document.createElement("span");
      first.textContent =
        `${userOne.login}: ${metric.first}`;

      const label = document.createElement("strong");
      label.textContent = metric.label;

      const second = document.createElement("span");
      second.textContent =
        `${userTwo.login}: ${metric.second}`;

      row.append(first, label, second);
      comparison.appendChild(row);
    });

    const scoreOne =
      userOne.followers + userOne.public_repos + userOne.following;

    const scoreTwo =
      userTwo.followers + userTwo.public_repos + userTwo.following;

    const result = document.createElement("p");
    result.className = "battle-winner";

    if (scoreOne > scoreTwo) {
      result.textContent = `${userOne.login} has higher combined metrics!`;
    } else if (scoreTwo > scoreOne) {
      result.textContent = `${userTwo.login} has higher combined metrics!`;
    } else {
      result.textContent = "Both developers have equal combined metrics!";
    }

    comparison.appendChild(result);
    profilesBox.appendChild(comparison);

    showStatus("Developer comparison completed successfully.");
  } catch (error) {
    if (currentRequest !== requestNumber) return;

    profilesBox.replaceChildren();
    repositoriesBox.replaceChildren();

    showStatus(error.message, "error");
  } finally {
    if (currentRequest === requestNumber) {
      compareButton.disabled = false;
    }
  }
});