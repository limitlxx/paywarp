/**
 * Test script to simulate the exact contract call
 * 
 * This simulates what happens when you save bucket settings
 */

// Example bucket allocations (adjust these to match your current settings)
const currentBucketAllocations = [
  { id: 'billings', name: 'Billings Bucket', percentage: 30, enabled: true, color: '#3B82F6' },
  { id: 'growth', name: 'Growth Bucket', percentage: 25, enabled: true, color: '#8B5CF6' },
  { id: 'savings', name: 'Savings Bucket', percentage: 20, enabled: true, color: '#10B981' },
  { id: 'instant', name: 'Instant Bucket', percentage: 15, enabled: true, color: '#F59E0B' },
  { id: 'spendable', name: 'Spendables Bucket', percentage: 10, enabled: true, color: '#EF4444' },
]

console.log('🧪 Contract Call Simulation\n')

console.log('📊 Current Bucket Settings:')
currentBucketAllocations.forEach(bucket => {
  console.log(`  ${bucket.name}: ${bucket.percentage}% (${bucket.enabled ? 'enabled' : 'disabled'})`)
})

// Simulate the exact conversion logic from the app
const splitConfigUpdate = {
  billingsPercent: (currentBucketAllocations.find(a => a.id === 'billings')?.enabled ? 
    currentBucketAllocations.find(a => a.id === 'billings')?.percentage || 0 : 0) * 100,
  savingsPercent: (currentBucketAllocations.find(a => a.id === 'savings')?.enabled ? 
    currentBucketAllocations.find(a => a.id === 'savings')?.percentage || 0 : 0) * 100,
  growthPercent: (currentBucketAllocations.find(a => a.id === 'growth')?.enabled ? 
    currentBucketAllocations.find(a => a.id === 'growth')?.percentage || 0 : 0) * 100,
  instantPercent: (currentBucketAllocations.find(a => a.id === 'instant')?.enabled ? 
    currentBucketAllocations.find(a => a.id === 'instant')?.percentage || 0 : 0) * 100,
  spendablePercent: (currentBucketAllocations.find(a => a.id === 'spendable')?.enabled ? 
    currentBucketAllocations.find(a => a.id === 'spendable')?.percentage || 0 : 0) * 100,
}

const totalBasisPoints = splitConfigUpdate.billingsPercent + 
  splitConfigUpdate.savingsPercent + 
  splitConfigUpdate.growthPercent + 
  splitConfigUpdate.instantPercent + 
  splitConfigUpdate.spendablePercent

console.log('\n🔄 Contract Call Parameters:')
console.log('  setSplitConfig({')
console.log(`    billingsPercent: ${splitConfigUpdate.billingsPercent},`)
console.log(`    savingsPercent: ${splitConfigUpdate.savingsPercent},`)
console.log(`    growthPercent: ${splitConfigUpdate.growthPercent},`)
console.log(`    instantPercent: ${splitConfigUpdate.instantPercent},`)
console.log(`    spendablePercent: ${splitConfigUpdate.spendablePercent}`)
console.log('  })')

console.log('\n📊 Validation:')
console.log(`  Total basis points: ${totalBasisPoints}`)
console.log(`  Expected: 10000`)
console.log(`  Contract validation: ${totalBasisPoints === 10000 ? '✅ PASS' : '❌ FAIL'}`)

if (totalBasisPoints !== 10000) {
  console.log(`  ⚠️  ERROR: Sum is ${totalBasisPoints} but contract expects 10000`)
  console.log(`  💡 Difference: ${totalBasisPoints - 10000} basis points`)
}

console.log('\n🎯 Next Steps:')
if (totalBasisPoints === 10000) {
  console.log('  ✅ This configuration should work with the contract!')
  console.log('  📝 Make sure your UI shows these exact percentages before saving')
} else {
  console.log('  ❌ This configuration will fail')
  console.log('  🔧 Adjust the percentages so they sum to exactly 100%')
}

console.log('\n🎉 Test Complete!')