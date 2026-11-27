export interface BrandConfig {
  identity: {
    name: string;
    extensionName: string;
    shortName: string;
    slug: string;
    ecosystem: string;
    tagline: string;
    description: string;
  };
  links: {
    website: string | null;
    github: string | null;
    documentation: string | null;
    support: string | null;
  };
  assets: {
    logoLight: string;
    logoDark: string;
    icon: string;
  };
  browser: {
    geckoId: string;
  };
}

export const brandConfig: BrandConfig = {
  identity: {
    name: "RankMiso",
    extensionName: "RankMiso — Free, Open-Source SEO Analyzer",
    shortName: "RankMiso",
    slug: "rankmiso",
    ecosystem: "Miso Ecosystem",
    tagline: "Every page. Every detail.",
    description: "A free, open-source SEO browser extension.",
  },
  links: {
    website: "https://misoecosystem.com",
    github: null,
    documentation: null,
    // Funding destination for the README and FUNDING.yml; the extension UI never shows it.
    support: "https://github.com/sponsors/EdeesonOpina",
  },
  assets: {
    logoLight: "/brand/logo-light.png",
    logoDark: "/brand/logo-dark.png",
    icon: "/brand/icon.png",
  },
  browser: {
    geckoId: "rankmiso@rankmiso.extension",
  },
};
