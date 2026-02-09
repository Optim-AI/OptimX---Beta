// scripts/check-plan-status.ts
// Admin utility to check the current status of the plan system
// Usage: npx tsx scripts/check-plan-status.ts

import { PlansDAO } from '../database/models/Plans.dao';

async function checkPlanStatus() {
  try {
    console.log('\n🔍 Checking Plan System Status...\n');

    const hasActivePlans = await PlansDAO.hasActivePlans();
    const allPlans = await PlansDAO.getAll();

    // System status
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 SYSTEM STATUS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (hasActivePlans) {
      console.log('✅ Plan System: ENABLED');
      console.log('   Mode: Subscription-based');
      console.log('   New users: MUST select a plan after signup\n');
    } else {
      console.log('💳 Plan System: DISABLED');
      console.log('   Mode: Pay-as-you-go only');
      console.log('   New users: Can signup and buy credits without plans\n');
    }

    // List all plans
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 ACTIVE PLANS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (allPlans.length === 0) {
      console.log('   (No active plans found)\n');
    } else {
      allPlans.forEach((plan, index) => {
        console.log(`${index + 1}. ${plan.name}`);
        console.log(`   Billing: ${plan.billingCycle}`);
        console.log(`   Price: ₹${plan.priceInr}`);
        console.log(`   Credits: ${plan.imageCredits} images, ${plan.videoCredits}s video`);
        console.log(`   Status: ${plan.isActive ? '✅ Active' : '❌ Inactive'}`);
        console.log('');
      });
    }

    // Instructions
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔧 MANAGEMENT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('To toggle plans:');
    console.log('  npx tsx scripts/toggle-plans.ts on   # Enable plans');
    console.log('  npx tsx scripts/toggle-plans.ts off  # Disable plans\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error checking plan status:', error);
    process.exit(1);
  }
}

checkPlanStatus();
