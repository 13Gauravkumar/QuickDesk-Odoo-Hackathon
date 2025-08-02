import React, { useState, useEffect } from 'react';
import axios from 'axios';

const AutomationManager = () => {
  const [automations, setAutomations] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedAutomation, setSelectedAutomation] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger: {
      type: 'ticket_created',
      conditions: []
    },
    conditions: [],
    actions: [],
    categories: [],
    tags: [],
    isActive: true
  });

  useEffect(() => {
    fetchAutomations();
    fetchTemplates();
  }, []);

  const fetchAutomations = async () => {
    try {
      setIsLoading(true);
      const response = await axios.get('/api/automation');
      setAutomations(response.data.automations);
    } catch (error) {
      console.error('Error fetching automations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await axios.get('/api/automation/templates');
      setTemplates(response.data.templates);
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const handleCreateAutomation = () => {
    setSelectedAutomation(null);
    setFormData({
      name: '',
      description: '',
      trigger: {
        type: 'ticket_created',
        conditions: []
      },
      conditions: [],
      actions: [],
      categories: [],
      tags: [],
      isActive: true
    });
    setIsModalOpen(true);
  };

  const handleEditAutomation = (automation) => {
    setSelectedAutomation(automation);
    setFormData({
      name: automation.name,
      description: automation.description,
      trigger: automation.trigger,
      conditions: automation.conditions,
      actions: automation.actions,
      categories: automation.categories,
      tags: automation.tags,
      isActive: automation.isActive
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      
      if (selectedAutomation) {
        await axios.put(`/api/automation/${selectedAutomation._id}`, formData);
      } else {
        await axios.post('/api/automation', formData);
      }
      
      fetchAutomations();
      setIsModalOpen(false);
      setSelectedAutomation(null);
    } catch (error) {
      console.error('Error saving automation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAutomation = async (id) => {
    if (window.confirm('Are you sure you want to delete this automation?')) {
      try {
        await axios.delete(`/api/automation/${id}`);
        fetchAutomations();
      } catch (error) {
        console.error('Error deleting automation:', error);
      }
    }
  };

  const handleToggleAutomation = async (automation) => {
    try {
      await axios.put(`/api/automation/${automation._id}`, {
        isActive: !automation.isActive
      });
      fetchAutomations();
    } catch (error) {
      console.error('Error toggling automation:', error);
    }
  };

  const handleTestAutomation = async (automation) => {
    try {
      const ticketId = prompt('Enter a ticket ID to test this automation:');
      if (ticketId) {
        const response = await axios.post(`/api/automation/${automation._id}/test`, {
          ticketId
        });
        
        alert(`Test Results:\nShould Execute: ${response.data.shouldExecute}\nMatches Trigger: ${response.data.matchesTrigger}\nMatches Conditions: ${response.data.matchesConditions}`);
      }
    } catch (error) {
      console.error('Error testing automation:', error);
      alert('Error testing automation');
    }
  };

  const addCondition = () => {
    setFormData(prev => ({
      ...prev,
      conditions: [...prev.conditions, {
        field: '',
        operator: 'equals',
        value: ''
      }]
    }));
  };

  const removeCondition = (index) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.filter((_, i) => i !== index)
    }));
  };

  const updateCondition = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      conditions: prev.conditions.map((condition, i) => 
        i === index ? { ...condition, [field]: value } : condition
      )
    }));
  };

  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, {
        type: 'assign_ticket',
        parameters: {}
      }]
    }));
  };

  const removeAction = (index) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }));
  };

  const updateAction = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((action, i) => 
        i === index ? { ...action, [field]: value } : action
      )
    }));
  };

  const loadTemplate = (template) => {
    setFormData({
      name: template.name,
      description: template.description,
      trigger: template.trigger,
      conditions: template.conditions || [],
      actions: template.actions || [],
      categories: [],
      tags: [],
      isActive: true
    });
    setIsModalOpen(true);
  };

  const getStatusBadge = (automation) => {
    return automation.isActive ? (
      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
        Active
      </span>
    ) : (
      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
        Inactive
      </span>
    );
  };

  const getTriggerTypeLabel = (type) => {
    const labels = {
      ticket_created: 'Ticket Created',
      ticket_updated: 'Ticket Updated',
      comment_added: 'Comment Added',
      status_changed: 'Status Changed',
      priority_changed: 'Priority Changed',
      assigned_changed: 'Assignment Changed',
      time_based: 'Time Based',
      sla_breached: 'SLA Breached'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Automation Rules</h2>
          <p className="text-gray-600">Manage workflow automation rules</p>
        </div>
        <button
          onClick={handleCreateAutomation}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create Automation
        </button>
      </div>

      {/* Templates */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((template, index) => (
            <div
              key={index}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors cursor-pointer"
              onClick={() => loadTemplate(template)}
            >
              <h4 className="font-medium text-gray-900">{template.name}</h4>
              <p className="text-sm text-gray-600 mt-1">{template.description}</p>
              <div className="mt-2">
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {getTriggerTypeLabel(template.trigger.type)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Automations List */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold">Active Automations</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {automations.map((automation) => (
            <div key={automation._id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium text-gray-900">{automation.name}</h4>
                    {getStatusBadge(automation)}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{automation.description}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-xs text-gray-500">
                      Trigger: {getTriggerTypeLabel(automation.trigger.type)}
                    </span>
                    <span className="text-xs text-gray-500">
                      Conditions: {automation.conditions.length}
                    </span>
                    <span className="text-xs text-gray-500">
                      Actions: {automation.actions.length}
                    </span>
                    <span className="text-xs text-gray-500">
                      Executions: {automation.executionCount}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleTestAutomation(automation)}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => handleToggleAutomation(automation)}
                    className={`px-3 py-1 text-xs rounded ${
                      automation.isActive
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {automation.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleEditAutomation(automation)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteAutomation(automation._id)}
                    className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold">
                {selectedAutomation ? 'Edit Automation' : 'Create Automation'}
              </h3>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trigger Type
                  </label>
                  <select
                    value={formData.trigger.type}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      trigger: { ...prev.trigger, type: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ticket_created">Ticket Created</option>
                    <option value="ticket_updated">Ticket Updated</option>
                    <option value="comment_added">Comment Added</option>
                    <option value="status_changed">Status Changed</option>
                    <option value="priority_changed">Priority Changed</option>
                    <option value="assigned_changed">Assignment Changed</option>
                    <option value="time_based">Time Based</option>
                    <option value="sla_breached">SLA Breached</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>

              {/* Conditions */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium">Conditions</h4>
                  <button
                    type="button"
                    onClick={addCondition}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                  >
                    Add Condition
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.conditions.map((condition, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <select
                        value={condition.field}
                        onChange={(e) => updateCondition(index, 'field', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select Field</option>
                        <option value="status">Status</option>
                        <option value="priority">Priority</option>
                        <option value="category">Category</option>
                        <option value="assignedTo">Assigned To</option>
                        <option value="createdBy">Created By</option>
                      </select>
                      <select
                        value={condition.operator}
                        onChange={(e) => updateCondition(index, 'operator', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="equals">Equals</option>
                        <option value="not_equals">Not Equals</option>
                        <option value="contains">Contains</option>
                        <option value="not_contains">Not Contains</option>
                        <option value="greater_than">Greater Than</option>
                        <option value="less_than">Less Than</option>
                      </select>
                      <input
                        type="text"
                        value={condition.value}
                        onChange={(e) => updateCondition(index, 'value', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Value"
                      />
                      <button
                        type="button"
                        onClick={() => removeCondition(index)}
                        className="px-2 py-2 text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-medium">Actions</h4>
                  <button
                    type="button"
                    onClick={addAction}
                    className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded hover:bg-green-200"
                  >
                    Add Action
                  </button>
                </div>
                <div className="space-y-3">
                  {formData.actions.map((action, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <select
                        value={action.type}
                        onChange={(e) => updateAction(index, 'type', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="assign_ticket">Assign Ticket</option>
                        <option value="change_status">Change Status</option>
                        <option value="change_priority">Change Priority</option>
                        <option value="add_tag">Add Tag</option>
                        <option value="remove_tag">Remove Tag</option>
                        <option value="send_email">Send Email</option>
                        <option value="send_notification">Send Notification</option>
                        <option value="escalate_ticket">Escalate Ticket</option>
                        <option value="add_comment">Add Comment</option>
                      </select>
                      <input
                        type="text"
                        value={action.parameters?.comment || ''}
                        onChange={(e) => updateAction(index, 'parameters', { comment: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Parameters"
                      />
                      <button
                        type="button"
                        onClick={() => removeAction(index)}
                        className="px-2 py-2 text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : (selectedAutomation ? 'Update' : 'Create')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AutomationManager; 