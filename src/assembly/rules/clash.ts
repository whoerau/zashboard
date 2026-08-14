import { fetchRuleProvidersAPI, fetchRulesAPI } from '@/api/clash'

export const fetchRules = async () => {
  const [{ data: ruleData }, { data: providerData }] = await Promise.all([
    fetchRulesAPI(),
    fetchRuleProvidersAPI(),
  ])

  const rules = ruleData.rules.map((rule) => {
    const proxy = rule.proxy
    const proxyName = proxy.startsWith('route(') ? proxy.substring(6, proxy.length - 1) : proxy

    return {
      ...rule,
      proxy: proxyName,
    }
  })

  return { rules, ruleProviderList: Object.values(providerData.providers) }
}
