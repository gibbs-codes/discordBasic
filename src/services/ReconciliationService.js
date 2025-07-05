// src/services/reconciliationService.js - Integration with your Decider API
import axios from 'axios';
import { logger } from '../utils/logger.js';

export class ReconciliationService {
  constructor() {
    this.apiUrl = process.env.RECONCILIATION_API_URL || 'http://localhost:3000';
    this.timeout = 15000; // 15 second timeout
  }

  // Run daily reconciliation - calls your existing /reconcile endpoint
  async runReconciliation(targetDate = null) {
    try {
      logger.info('🔄 Calling reconciliation API...');
      
      const requestBody = targetDate ? { date: targetDate } : {};
      
      const response = await axios.post(`${this.apiUrl}/reconcile`, requestBody, {
        timeout: this.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DiscordCoachBot/1.0'
        }
      });

      logger.info('✅ Reconciliation API response received');
      
      // Your API returns: { success: true, type: 'daily', results: {...} }
      if (response.data.success) {
        return this.processReconciliationData(response.data.results);
      } else {
        throw new Error('Reconciliation API returned success: false');
      }
      
    } catch (error) {
      logger.error('❌ Reconciliation API error:', error.message);
      
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Reconciliation service is not running. Start your decider app first.');
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error('Reconciliation service timed out. It may be processing a complex request.');
      } else if (error.response?.status === 500) {
        throw new Error(`Reconciliation service error: ${error.response.data?.error || 'Internal server error'}`);
      } else {
        throw new Error(`Reconciliation failed: ${error.message}`);
      }
    }
  }

  // Process and structure the API response for LLM consumption
  processReconciliationData(rawResults) {
    // Your API structure based on your project docs:
    // results: { date, debt_updates, new_bonuses, new_punishments, completed_punishments, 
    //           debt_payments_made, new_debt_assigned, uber_earnings_processed, 
    //           total_bonus_amount, summary }
    
    const structured = {
      date: rawResults.date,
      summary: rawResults.summary || 'No summary provided',
      
      // Financial data
      financials: {
        uberEarnings: rawResults.uber_earnings_processed || 0,
        totalBonuses: rawResults.total_bonus_amount || 0,
        newDebtAmount: this.calculateNewDebtAmount(rawResults.new_debt_assigned),
        debtPayments: this.calculateDebtPayments(rawResults.debt_payments_made),
        currentDebtTotal: this.calculateCurrentDebtTotal(rawResults.debt_updates)
      },
      
      // Performance tracking
      performance: {
        newBonuses: rawResults.new_bonuses || [],
        newPunishments: rawResults.new_punishments || [],
        completedPunishments: rawResults.completed_punishments || [],
        violations: rawResults.new_debt_assigned || []
      },
      
      // Debt management
      debt: {
        updates: rawResults.debt_updates || [],
        payments: rawResults.debt_payments_made || [],
        newAssignments: rawResults.new_debt_assigned || []
      },
      
      // Overall assessment
      assessment: this.generatePerformanceAssessment(rawResults),
      
      // Raw data for detailed analysis
      raw: rawResults
    };

    logger.info(`Processed reconciliation: $${structured.financials.totalBonuses} bonuses, $${structured.financials.currentDebtTotal} debt`);
    
    return structured;
  }

  // Calculate new debt amount from assignments
  calculateNewDebtAmount(newDebtAssigned) {
    if (!Array.isArray(newDebtAssigned)) return 0;
    return newDebtAssigned.reduce((total, debt) => total + (debt.amount || 0), 0);
  }

  // Calculate total debt payments made
  calculateDebtPayments(debtPayments) {
    if (!Array.isArray(debtPayments)) return 0;
    return debtPayments.reduce((total, payment) => total + (payment.amount || 0), 0);
  }

  // Calculate current total debt
  calculateCurrentDebtTotal(debtUpdates) {
    if (!Array.isArray(debtUpdates)) return 0;
    return debtUpdates.reduce((total, debt) => total + (debt.current_amount || 0), 0);
  }

  // Generate performance assessment for LLM context
  generatePerformanceAssessment(results) {
    const assessment = {
      grade: 'C',
      financialStatus: 'neutral',
      workoutCompliance: 'unknown',
      overallTrend: 'stagnant'
    };

    // Financial assessment
    const bonuses = results.total_bonus_amount || 0;
    const newDebt = this.calculateNewDebtAmount(results.new_debt_assigned);
    
    if (bonuses > newDebt && bonuses > 20) {
      assessment.financialStatus = 'positive';
      assessment.grade = 'B';
    } else if (newDebt > bonuses && newDebt > 30) {
      assessment.financialStatus = 'negative';
      assessment.grade = 'D';
    }

    // Workout assessment based on punishments
    const newPunishments = results.new_punishments?.length || 0;
    const completedPunishments = results.completed_punishments?.length || 0;
    
    if (completedPunishments > newPunishments) {
      assessment.workoutCompliance = 'improving';
    } else if (newPunishments > 2) {
      assessment.workoutCompliance = 'declining';
      assessment.grade = 'D';
    }

    // Overall trend
    if (assessment.financialStatus === 'positive' && assessment.workoutCompliance === 'improving') {
      assessment.overallTrend = 'improving';
      assessment.grade = 'A';
    } else if (assessment.financialStatus === 'negative' || assessment.workoutCompliance === 'declining') {
      assessment.overallTrend = 'declining';
    }

    return assessment;
  }

  // Get historical reconciliation data
  async getHistory(type = 'daily', period = 30) {
    try {
      const params = new URLSearchParams();
      params.append('type', type);
      
      if (type === 'daily') {
        params.append('days', period.toString());
      } else {
        params.append('weeks', period.toString());
      }
      
      const response = await axios.get(`${this.apiUrl}/reconcile/history?${params}`, {
        timeout: this.timeout
      });
      
      return response.data.history;
    } catch (error) {
      logger.error('Failed to get reconciliation history:', error.message);
      throw new Error(`History retrieval failed: ${error.message}`);
    }
  }

  // Test API connection health
  async testConnection() {
    try {
      const response = await axios.get(`${this.apiUrl}/health`, {
        timeout: 5000
      });
      
      if (response.status === 200) {
        logger.info('✅ Reconciliation API connection successful');
        return true;
      }
      
      return false;
    } catch (error) {
      logger.error('❌ Reconciliation API connection failed:', error.message);
      return false;
    }
  }

  // Get current system rules (for future function calling)
  async getRulesStatus() {
    try {
      const response = await axios.get(`${this.apiUrl}/rules/status`, {
        timeout: this.timeout
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to get rules status:', error.message);
      throw new Error(`Rules status failed: ${error.message}`);
    }
  }

  // Future: Allow LLM to modify system rules
  async modifyRule(ruleName, modifierPercent, reason) {
    try {
      const response = await axios.post(`${this.apiUrl}/rules/modify`, {
        rule_name: ruleName,
        modifier_percent: modifierPercent,
        reason: reason
      }, {
        timeout: this.timeout
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to modify rule:', error.message);
      throw new Error(`Rule modification failed: ${error.message}`);
    }
  }

  // Future: Manual punishment assignment (for LLM function calling)
  async assignPunishment(type, duration, reason) {
    try {
      const response = await axios.post(`${this.apiUrl}/punishments`, {
        type,
        duration,
        reason,
        assigned_by: 'discord-bot',
        timestamp: new Date().toISOString()
      }, {
        timeout: this.timeout
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to assign punishment:', error.message);
      throw new Error(`Punishment assignment failed: ${error.message}`);
    }
  }

  // Future: Manual debt assignment
  async assignDebt(amount, reason) {
    try {
      const response = await axios.post(`${this.apiUrl}/debt`, {
        amount,
        reason,
        assigned_by: 'discord-bot',
        timestamp: new Date().toISOString()
      }, {
        timeout: this.timeout
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to assign debt:', error.message);
      throw new Error(`Debt assignment failed: ${error.message}`);
    }
  }

  // Get API configuration info
  getConfig() {
    return {
      apiUrl: this.apiUrl,
      timeout: this.timeout,
      endpoints: {
        reconcile: `${this.apiUrl}/reconcile`,
        history: `${this.apiUrl}/reconcile/history`,
        health: `${this.apiUrl}/health`,
        rules: `${this.apiUrl}/rules/status`
      }
    };
  }
}