// scripts/toggle-plans.ts
// Admin utility to enable/disable the entire plan system
// Usage:
//   npx tsx scripts/toggle-plans.ts on   # Enable all plans
//   npx tsx scripts/toggle-plans.ts off  # Disable all plans

import { PlansDAO } from '../database/models/Plans.dao';

async function togglePlans() {
  const args = process.argv.slice(2);
  const action = args[0]?.toLowerCase();

  if (!action || (action !== 'on' && action !== 'off')) {
    console.error('❌ Invalid usage!');
    console.log('\nUsage:');
    console.log('  npx tsx scripts/toggle-plans.ts on   # Enable all plans (show plan selection)');
    console.log('  npx tsx scripts/toggle-plans.ts off  # Disable all plans (pay-as-you-go only)');
    process.exit(1);
  }

  const enable = action === 'on';

  try {
    console.log(`\n🔧 ${enable ? 'Enabling' : 'Disabling'} all plans...`);

    const updatedCount = await PlansDAO.toggleAllPlans(enable);

    if (updatedCount === 0) {
      console.log('⚠️  No plans found in database');
      process.exit(0);
    }

    console.log(`✅ Successfully ${enable ? 'enabled' : 'disabled'} ${updatedCount} plan(s)`);

    if (enable) {
      console.log('\n📋 Plan selection is now REQUIRED for new signups');
      console.log('   Users will be redirected to /pricing after signup');
    } else {
      console.log('\n💳 Pay-as-you-go mode is now ACTIVE');
      console.log('   Users can signup and use credits without selecting a plan');
      console.log('   Plans will not be shown in the pricing page');
    }

    // Show status of plans
    console.log('\n📊 Plan Status:');
    const allPlans = await PlansDAO.getAll();
    if (allPlans.length > 0) {
      allPlans.forEach((plan) => {
        console.log(`   ✓ ${plan.name} (${plan.billingCycle})`);
      });
    } else {
      console.log('   (No active plans)');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error toggling plans:', error);
    process.exit(1);
  }
}

togglePlans();
