cat > netlify/functions/lib/store.js << 'EOF'
const { getStore } = require("@netlify/blobs");

function store() {
  return getStore("businesses");
}

async function saveBusiness(businessId, config) {
  const s = store();
  await s.setJSON(`business:${businessId}`, { ...config, businessId });
  await s.set(`phone-index:${config.phoneNumberId}`, businessId);
}

async function getBusiness(businessId) {
  const s = store();
  return s.get(`business:${businessId}`, { type: "json" });
}

async function getBusinessByPhoneNumberId(phoneNumberId) {
  const s = store();
  const businessId = await s.get(`phone-index:${phoneNumberId}`, { type: "text" });
  if (!businessId) return null;
  return getBusiness(businessId);
}

async function getHistory(businessId, customerPhone) {
  const s = store();
  const history = await s.get(`history:${businessId}:${customerPhone}`, { type: "json" });
  return history || [];
}

async function saveHistory(businessId, customerPhone, history) {
  const s = store();
  await s.setJSON(`history:${businessId}:${customerPhone}`, history.slice(-6));
}

module.exports = {
  saveBusiness,
  getBusiness,
  getBusinessByPhoneNumberId,
  getHistory,
  saveHistory,
};
EOF
