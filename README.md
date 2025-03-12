<a name="readme-top"></a>

[![hacs][hacs-validate]][hacs-url] ![Github last commit][git-last-commit-badge] ![git-download-all][git-download-all-badge] ![git-download-latest][git-download-latest-badge] [![forum][forum-badge]][forum-url] 

# 🗄️ Sidebar Organizer

<table>
  <thead>
    <tr>
      <th width="25%">Sidebar Default</th>
      <th width="25%">Sidebar organized</th>
      <th width="25%">Collapsed groups</th>
      <th width="25%">Expanded </th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td colspan="4">
      </td>
    </tr>
    <tr>
      <td>
       <img src="https://raw.githubusercontent.com/ngocjohn/sidebar-organizer/refs/heads/main/assets/sidebar-default.png" />
      </td>
      <td>
       <img src="https://raw.githubusercontent.com/ngocjohn/sidebar-organizer/refs/heads/main/assets/sidebar-organizer-anim.gif" />
      </td>
      <td>
       <img src="https://raw.githubusercontent.com/ngocjohn/sidebar-organizer/refs/heads/main/assets/sidebar-light-theme.png" />
      </td>
			<td>
       <img src="https://raw.githubusercontent.com/ngocjohn/sidebar-organizer/refs/heads/main/assets/sidebar-items-expanded.png" />
      </td>
    </tr>
  </tbody>
</table>

## Introduction

**Sidebar Organizer** is a custom Home Assistant plugin designed to give you full control over the layout and organization of the sidebar. It allows you to customize the appearance, group items, and reorder or collapse items for a cleaner, more intuitive navigation experience.

With Sidebar Organizer, managing the sidebar in Home Assistant becomes easy and flexible. Whether you want to declutter your sidebar or create a more streamlined view, Sidebar Organizer is here to help.

## Features

- **Customize Sidebar Appearance**: Personalize the look of your sidebar with custom styles, colors, and layouts.
- **Group Menu Items**: Organize sidebar items into specific groups for better clarity and separation of content.
- **Reorder Items**: Drag and drop to reorder items within groups or across the sidebar.
- **Expand/Collapse Groups**: Expand or collapse groups of items to save space and minimize clutter.
- **Manage Bottom Items**: Move specific items to the bottom of the sidebar for quick access.
- **Default Collapse Settings**: Choose which groups of items should be collapsed by default for a cleaner view.

# Installation

## [HACS](https://hacs.xyz) (Home Assistant Community Store)

1. Go to HACS page on your Home Assistant instance
2. Add this repository via HACS Custom repositories [How to add Custom Repositories](https://hacs.xyz/docs/faq/custom_repositories/)

```
https://github.com/ngocjohn/sidebar-organizer
```

3. Select `Dashboard`
1. Press add icon and search for `Sidebar Organizer`
1. Select Sidebar Organizer repo and install
1. Force refresh the Home Assistant page `Ctrl` + `F5` / `Shift` + `⌘` + `R`
1. Add sidebar-organizer to your page

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=ngocjohn&repository=sidebar-organizer&category=plugin)

## Manual

<details>
  <summary>Click to expand installation instructions</summary>

1. Download the [sidebar-organizer.js](https://github.com/ngocjohn/sidebar-organizer/releases/latest).
2. Place the downloaded file on your Home Assistant machine in the `config/www` folder (when there is no `www` folder in the folder where your `configuration.yaml` file is, create it and place the file there).
3. In Home Assistant go to `Settings->Dashboards->Resources` (When there is no `resources` tag on the `Lovelace Dashboard` page, enable advanced mode in your account settings, and retry this step).
4. Add a new resource:
   - Url = `/local/sidebar-organizer.js`
   - Resource type = `module`
5. Force refresh the Home Assistant page `Ctrl` + `F5` / `Shift` + `⌘` + `R`.
6. Add sidebar-organizer to your page.

</details>

# Usage

## Configuration dialog

- Access the **Sidebar Organizer** Configuration menu by press and hold the Profile menu (the last item in the sidebar).

- The settings menu is divided into three categories: Appearance, Panels, and Raw Code. Below is a breakdown of what you can customize in each section.

  ![Configuration Dialog](assets/config-dialog.gif)

### Appearance

- **Header Title**: Change the header title.
- **Hide Header Toggle**: A button that allows you to quickly toggle between expanding or collapsing the sidebar groups.

You can set different styles for **Light** and **Dark** modes by specifying the following settings:

- **Line Color**: The color of the divider line between sidebar items.
- **Background Color**: The background color of the divider area in the sidebar.
- **Border Top Color**: The color for the top border of the sidebar divider.
- **Scrollbar Thumb Color**: Customize the color of the scrollbar's thumb for the sidebar.
- **Sidebar Background Color**: The overall background color for the sidebar.
- **Border Radius**: Customize the corner rounding for the divider. You can specify a numeric value for how rounded the corners of each panel should appear.

  All stylization is visible in the preview.

  ![Appearance](assets/sidebar-color-config.gif)

  <details>
    <summary>Yaml example</summary>

  ```yaml
  header_title: 'My sidebar'
  hide_header_toggle: false
  color_config:
    border_radius: 8
    light:
      divider_color: '#dddddd'
      background_color: '#ffffff'
      border_top_color: '#e0e0e0'
      scrollbar_thumb_color: '#cccccc'
      custom_sidebar_background_color: '#f5f5f5'
    dark:
      divider_color: '#444444'
      background_color: '#333333'
      border_top_color: '#555555'
      scrollbar_thumb_color: '#666666'
      custom_sidebar_background_color: '#222222'
  ```

  </details>

### Panels

In this section, you can organize the layout of the sidebar panels by customizing how items are displayed. The following options are available:

- **Bottom Items**: Select the items that will be fixed at the bottom of the sidebar, allowing you to easily access frequently used panels.

- **Custom Groups**: Organize your sidebar items into custom groups for better clarity and navigation. You can create, rename, and reorder these groups based on your preferences.

- **Default Collapsed**: Choose which groups will be collapsed by default when the sidebar loads, helping to reduce clutter and create a cleaner interface.

  <table>
    <thead>
      <tr>
        <th width="50%">Bottom Panel</th>
        <th width="50%">Group Sorting</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td colspan="2">
        </td>
      </tr>
      <tr>
        <td>
        <img src="https://raw.githubusercontent.com/ngocjohn/sidebar-organizer/refs/heads/main/assets/config-bottom-panel.png" />
        </td>
        <td>
        <img src="https://raw.githubusercontent.com/ngocjohn/sidebar-organizer/refs/heads/main/assets/config-groups-sort.gif" />
        </td>
      </tr>
      <tr>
        <td colspan="2">
        Group items setting
        </td>
      </tr>
        <tr>
        <td colspan="2">
        <img src="https://raw.githubusercontent.com/ngocjohn/sidebar-organizer/refs/heads/main/assets/config-group-items.gif" />
        </td>
      </tr>
    </tbody>
  </table>

  <details>
    <summary>Yaml example</summary>

  ```yaml
  bottom_items:
    - config/lovelace/resources
  custom_groups:
    dashboards:
      - extra-menu
      - ha-dash
      - dashboard-moon
      - test-cards
      - uni-vehicle
      - dashboard-vehicle
    lovelace_yaml:
      - lovelace-test-yaml
      - ytube-card
    components:
      - browser-mod
      - config/integrations
    media:
      - media-browser
    system:
      - calendar
      - energy
      - history
      - logbook
      - todo
  default_collapsed:
    - system
    - dashboards
    - components
  ```

  </details>

### Code

- This section lets you edit the raw YAML configuration file used by Sidebar Organizer. You can also download the current configuration as a YAML file, which should be saved in the `www` folder with the name `sidebar-organizer.yaml`.

- _This file is useful for synchronizing your sidebar settings across multiple devices. For instance, if you have a companion app and want to apply the same sidebar setup without repeating the entire process, you can enable the option to use the YAML config file in the app. This ensures the sidebar layout will be consistent with the configuration from the YAML file._

  ![Config RAW Code](assets/config-raw-code.png)

---

&copy; 2025 Viet Ngoc

[https://github.com/ngocjohn/](https://github.com/ngocjohn/)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!--Badges-->
[forum-url]: https://community.home-assistant.io/t/sidebar-organizer
[forum-badge]:https://img.shields.io/badge/forum-community?style=flat&logo=homeassistant&label=community&color=blue
[hacs-validate]: https://github.com/ngocjohn/sidebar-organizer/actions/workflows/validate.yaml/badge.svg
[hacs-url]: https://github.com/ngocjohn/sidebar-organizer/actions/workflows/validate.yaml
[git-last-commit-badge]: https://img.shields.io/github/last-commit/ngocjohn/sidebar-organizer
[git-download-all-badge]: https://img.shields.io/github/downloads/ngocjohn/sidebar-organizer/total?style=flat&logo=homeassistantcommunitystore&logoSize=auto&label=Downloads&color=%2318BCF2
[git-download-latest-badge]: https://img.shields.io/github/downloads/ngocjohn/sidebar-organizer/latest/total?style=flat&logo=homeassistantcommunitystore&logoSize=auto

<!--Urls-->
