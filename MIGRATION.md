# Migration Guide for Deploying the App to the Library's GitHub Repository

This guide explains how to move the app from your private GitHub account to the library’s GitHub repository and configure it for deployment using GitHub Pages.

## Steps to Move the App

### 1. Clone the Library's Repository

First, clone the repository of the library from GitHub to your local machine:

`git clone https://github.com/library-account/repository-name.git`
`cd repository-name`

### 2. Copy the App Files

Copy all the app files (the entire project folder) from your private account's repo to the library’s repo.

### 3. Update the `package.json`

#### Homepage URL

Update the `homepage` field in the `package.json` to reflect the new repository URL.

- If the app will be deployed at `https://library-account.github.io/repository-name/`, set the `homepage` in `package.json` to:

"homepage": "https://library-account.github.io/repository-name"

- If the app will be deployed at the root of `https://library-account.github.io/`, set it to:

"homepage": "https://library-account.github.io"

#### Update the Deploy Script

Ensure that the `deploy` script is set to use the correct branch and deployment settings:

"deploy": "vite build && gh-pages -d dist"

### 4. Set Up the `gh-pages` Branch

If the `gh-pages` branch does not exist in the library’s repository, create it:

`git checkout --orphan gh-pages`
`git rm -rf .`
`git commit --allow-empty -m "Initial gh-pages commit"`
`git push origin gh-pages`

### 5. Push the Changes to the Library Repo

Once everything is copied and updated, commit the changes and push them to the library’s GitHub repository:

`git add .`
`git commit -m "Move app to library's repository"`
`git push origin main`

### 6. Configure GitHub Pages

Go to the repository settings in GitHub, and under the **Pages** section, enable GitHub Pages from the `gh-pages` branch. This will make sure the app is served correctly.

### 7. Test the Deployment

After pushing the changes, run the `npm run deploy` command to deploy the app to GitHub Pages:

`npm run deploy`

Your app should now be live on the new URL.

---

## Summary of Changes to `package.json`

- **Update `homepage`**: Set the correct URL for GitHub Pages in the `homepage` field.
- **Ensure correct `deploy` script**: Set the deploy script to deploy to the `gh-pages` branch.
