import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import { brandConfig } from "./src/config/brand.config";
import { permissionsConfig } from "./src/config/permissions.config";

const icons = {
  16: "/icon-16.png",
  32: "/icon-32.png",
  48: "/icon-48.png",
  128: "/icon-128.png",
};

export default defineConfig({
  modules: ["@wxt-dev/module-vue"],
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: ({ browser }) => ({
    name: brandConfig.identity.name,
    description: brandConfig.identity.description,
    icons,
    action: {
      default_title: brandConfig.identity.name,
      default_icon: icons,
    },
    permissions: [
      ...permissionsConfig.required.map((permission) => permission.name),
      ...(browser === "firefox" ? [] : ["sidePanel"]),
    ],
    optional_permissions: ["tabs"],
    optional_host_permissions:
      browser === "firefox" ? undefined : [...permissionsConfig.optionalHosts],
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    browser_specific_settings:
      browser === "firefox"
        ? {
            gecko: {
              id: brandConfig.browser.geckoId,
              strict_min_version: "140.0",
              data_collection_permissions: {
                required: ["none"],
              },
            },
          }
        : undefined,
    options_ui: {
      page: "options.html",
      open_in_tab: true,
    },
  }),
});
