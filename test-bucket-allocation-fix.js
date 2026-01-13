/**
 * Test script to verify bucket allocation fix
 * 
 * This script tests the bucket allocation logic to ensure it properly
 * handles enabled/disabled buckets and sums to 100%
 */

// Mock bucket allocations (similar to what we have in the app)
const testAllocations = [
  { id: 'billings', name: 'Billings Bucket', percentage: 30, enabled: true, color: '#3B82F6' },
  { id: 'growth', name: 'Growth Bucket', percentage: 25, enabled: true, color: '#8B5CF6' },
  { id: 'savings', name: 'Savings Bucket', percentage: 20, enabled: true, color: '#10B981' },
  { id: 'instant', name: 'Instant Bucket', percentage: 15, enabled: true, color: '#F59E0B' },
  { id: 'spendable', name: 'Spendables Bucket', percentage: 10, enabled: false, color: '#EF4444' }, // Disabled
]

// Test function to convert to contract format (with basis points)
function convertToContractFormat(bucketAllocations) {
  return {
    billingsPercent: (bucketAllocations.find(a => a.id === 'billings')?.enabled ? 
      bucketAllocations.find(a => a.id === 'billings')?.percentage || 0 : 0) * 100, // Convert to basis points
    savingsPercent: (bucketAllocations.find(a => a.id === 'savings')?.enabled ? 
      bucketAllocations.find(a => a.id === 'savings')?.percentage || 0 : 0) * 100,
    growthPercent: (bucketAllocations.find(a => a.id === 'growth')?.enabled ? 
      bucketAllocations.find(a => a.id === 'growth')?.percentage || 0 : 0) * 100,
    instantPercent: (bucketAllocations.find(a => a.id === 'instant')?.enabled ? 
      bucketAllocations.find(a => a.id === 'instant')?.percentage || 0 : 0) * 100,
    spendablePercent: (bucketAllocations.find(a => a.id === 'spendable')?.enabled ? 
      bucketAllocations.find(a => a.id === 'spendable')?.percentage || 0 : 0) * 100,
  }
}

// Test validation function
function validateBucketAllocations(bucketAllocations) {
  const enabledAllocations = bucketAllocations.filter(a => a.enabled)
  const totalPercentage = enabledAllocations.reduce((sum, a) => sum + a.percentage, 0)
  
  if (enabledAllocations.length === 0) {
    return {
      isValid: false,
      error: 'At least one bucket must be enabled'
    }
  }
  
  if (totalPercentage !== 100) {
    return {
      isValid: false,
      error: `Enabled buckets must sum to 100%. Current total: ${totalPercentage}%`
    }
  }

  if (enabledAllocations.some(a => a.percentage < 0 || a.percentage > 100)) {
    return {
      isValid: false,
      error: 'Individual allocations must be between 0% and 100%'
    }
  }

  return { isValid: true }
}

// Redistribution function (same as in the app)
function redistributePercentages(bucketAllocations) {
  const enabledBuckets = bucketAllocations.filter(a => a.enabled)
  const disabledBuckets = bucketAllocations.filter(a => !a.enabled)
  
  if (enabledBuckets.length === 0) {
    // If no buckets are enabled, enable the first one with 100%
    return bucketAllocations.map((bucket, index) => ({
      ...bucket,
      enabled: index === 0,
      percentage: index === 0 ? 100 : 0
    }))
  }
  
  // Calculate current enabled total
  const currentEnabledTotal = enabledBuckets.reduce((sum, bucket) => sum + bucket.percentage, 0)
  
  // If enabled buckets already sum to 100%, just set disabled to 0
  if (currentEnabledTotal === 100) {
    return bucketAllocations.map(bucket => ({
      ...bucket,
      percentage: bucket.enabled ? bucket.percentage : 0
    }))
  }
  
  // Redistribute to make enabled buckets sum to 100%
  const targetTotal = 100
  const scaleFactor = targetTotal / currentEnabledTotal
  
  return bucketAllocations.map(bucket => {
    if (!bucket.enabled) {
      return { ...bucket, percentage: 0 }
    }
    
    const newPercentage = Math.round(bucket.percentage * scaleFactor)
    return { ...bucket, percentage: newPercentage }
  })
}

// Run tests
console.log('🧪 Testing Bucket Allocation Fix\n')

console.log('📊 Original Test Allocations:')
testAllocations.forEach(bucket => {
  console.log(`  ${bucket.name}: ${bucket.percentage}% (${bucket.enabled ? 'enabled' : 'disabled'})`)
})

console.log('\n🔄 After Redistribution:')
const redistributed = redistributePercentages(testAllocations)
redistributed.forEach(bucket => {
  console.log(`  ${bucket.name}: ${bucket.percentage}% (${bucket.enabled ? 'enabled' : 'disabled'})`)
})

console.log('\n✅ Validation Test (After Redistribution):')
const validation = validateBucketAllocations(redistributed)
console.log(`  Valid: ${validation.isValid}`)
if (!validation.isValid) {
  console.log(`  Error: ${validation.error}`)
}

console.log('\n🔄 Contract Format Conversion:')
const contractFormat = convertToContractFormat(redistributed)
console.log('  Contract values (basis points):', contractFormat)

const contractTotal = contractFormat.billingsPercent + 
  contractFormat.savingsPercent + 
  contractFormat.growthPercent + 
  contractFormat.instantPercent + 
  contractFormat.spendablePercent

console.log(`  Contract total: ${contractTotal} basis points (${contractTotal/100}%)`)
console.log(`  Will pass contract validation: ${contractTotal === 10000 ? '✅ YES' : '❌ NO'}`)

console.log('\n🎉 Test Complete!')