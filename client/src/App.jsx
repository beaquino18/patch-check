import { gql } from '@apollo/client'
import { useState } from 'react'
import { useMutation, useQuery } from '@apollo/client/react'
import './App.css'

const DEVICE_FIELDS = gql`
  fragment DeviceFields on Device {
    id
    nickname
    purchasedOn
    owner {
      id
      name
    }
    model {
      id
      company
      product
      version
      supportEndsOn
      status
    }
  }
`

const ALL_DEVICES = gql`
  query AllDevices {
    allDevices {
      ...DeviceFields
    }
  }
  ${DEVICE_FIELDS}
`

const DEVICES_BY_OWNER = gql`
  query DevicesByOwner($ownerId: ID!) {
    getDevicesByOwner(ownerId: $ownerId) {
      ...DeviceFields
    }
  }
  ${DEVICE_FIELDS}
`

const ADD_DEVICE = gql`
  mutation AddDevice(
    $nickname: String!
    $ownerId: ID!
    $modelId: ID!
    $purchasedOn: String
  ) {
    addDevice(
      nickname: $nickname
      ownerId: $ownerId
      modelId: $modelId
      purchasedOn: $purchasedOn
    ) {
      id
      nickname
    }
  }
`

const UPDATE_DEVICE = gql`
  mutation UpdateDevice(
    $id: ID!
    $nickname: String
    $ownerId: ID
    $modelId: ID
    $purchasedOn: String
  ) {
    updateDevice(
      id: $id
      nickname: $nickname
      ownerId: $ownerId
      modelId: $modelId
      purchasedOn: $purchasedOn
    ) {
      ...DeviceFields
    }
  }
  ${DEVICE_FIELDS}
`

const DELETE_DEVICE = gql`
  mutation DeleteDevice($id: ID!) {
    deleteDevice(id: $id)
  }
`

const ALL_OWNERS = gql`
  query AllOwners {
    allOwners {
      id
      name
    }
  }
`

const ALL_MODELS = gql`
  query AllModels {
    allModels {
      id
      company
      product
      version
    }
  }
`

const STATUS_DETAILS = {
  SUPPORTED: { label: 'Supported', description: 'Receiving security updates' },
  ENDING_SOON: { label: 'Ending soon', description: 'Plan an upgrade soon' },
  UNSUPPORTED: { label: 'Unsupported', description: 'Replace or upgrade now' },
  UNKNOWN: { label: 'Unknown', description: 'No published support date' },
}

const EMPTY_DEVICE = {
  nickname: '',
  ownerId: '',
  modelId: '',
  purchasedOn: '',
}

function formatDate(date) {
  if (!date) return 'Not published'

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

function App() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const [selectedOwnerId, setSelectedOwnerId] = useState('')
  const [newDevice, setNewDevice] = useState(EMPTY_DEVICE)
  const [editDevice, setEditDevice] = useState(EMPTY_DEVICE)
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  const devicesQuery = useQuery(ALL_DEVICES)
  const ownersQuery = useQuery(ALL_OWNERS)
  const modelsQuery = useQuery(ALL_MODELS)
  const filteredDevicesQuery = useQuery(DEVICES_BY_OWNER, {
    variables: { ownerId: selectedOwnerId },
    skip: !selectedOwnerId,
  })

  const [addDevice, addDeviceResult] = useMutation(ADD_DEVICE, {
    refetchQueries: [{ query: ALL_DEVICES }],
  })
  const [updateDevice, updateDeviceResult] = useMutation(UPDATE_DEVICE, {
    refetchQueries: [{ query: ALL_DEVICES }],
  })
  const [deleteDevice, deleteDeviceResult] = useMutation(DELETE_DEVICE, {
    refetchQueries: [{ query: ALL_DEVICES }],
  })

  function openDevice(device) {
    setSelectedDevice(device)
    setEditDevice({
      nickname: device.nickname,
      ownerId: device.owner.id,
      modelId: device.model.id,
      purchasedOn: device.purchasedOn ?? '',
    })
    setIsEditing(false)
    setIsConfirmingDelete(false)
  }

  const loading =
    devicesQuery.loading ||
    ownersQuery.loading ||
    modelsQuery.loading ||
    (selectedOwnerId && filteredDevicesQuery.loading)
  const error =
    devicesQuery.error ||
    ownersQuery.error ||
    modelsQuery.error ||
    filteredDevicesQuery.error

  function closeAddModal() {
    setIsAddModalOpen(false)
    setNewDevice(EMPTY_DEVICE)
    addDeviceResult.reset()
  }

  function closeDrawer() {
    setSelectedDevice(null)
    setIsEditing(false)
    setIsConfirmingDelete(false)
    updateDeviceResult.reset()
    deleteDeviceResult.reset()
  }

  function updateForm(setter) {
    return (event) => {
      const { name, value } = event.target
      setter((current) => ({ ...current, [name]: value }))
    }
  }

  async function handleAddDevice(event) {
    event.preventDefault()
    await addDevice({
      variables: {
        ...newDevice,
        purchasedOn: newDevice.purchasedOn || null,
      },
    })
    closeAddModal()
  }

  async function handleUpdateDevice(event) {
    event.preventDefault()
    const result = await updateDevice({
      variables: {
        id: selectedDevice.id,
        ...editDevice,
        purchasedOn: editDevice.purchasedOn || null,
      },
    })

    setSelectedDevice(result.data.updateDevice)
    setIsEditing(false)
  }

  async function handleDeleteDevice() {
    const result = await deleteDevice({ variables: { id: selectedDevice.id } })
    if (result.data.deleteDevice) closeDrawer()
  }

  if (loading) {
    return (
      <main className="app-shell">
        <section className="state-card" aria-live="polite">
          <span className="loader" aria-hidden="true" />
          <h1>Checking your devices</h1>
          <p>Loading the latest support information...</p>
        </section>
      </main>
    )
  }

  if (error) {
    return (
      <main className="app-shell">
        <section className="state-card state-card--error">
          <span className="state-icon" aria-hidden="true">!</span>
          <h1>We couldn’t load your devices</h1>
          <p role="alert">{error.message}</p>
          <p className="state-hint">Make sure the StillSafe server is running on port 4000.</p>
        </section>
      </main>
    )
  }

  const allDevices = devicesQuery.data.allDevices
  const devices = selectedOwnerId
    ? filteredDevicesQuery.data?.getDevicesByOwner ?? []
    : allDevices
  const statusCounts = Object.keys(STATUS_DETAILS).reduce((counts, status) => {
    counts[status] = devices.filter((device) => device.model.status === status).length
    return counts
  }, {})

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="StillSafe home">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>StillSafe</span>
        </a>
        <span className="header-note">Security support dashboard</span>
      </header>

      <div className="page-content" id="top">
        <section className="dashboard-intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">Your devices, one clear view</p>
            <h1 id="page-title">Know what’s protected.</h1>
            <p className="intro-description">
              Track support dates and act before your devices become a security risk.
            </p>
          </div>
          <button
            className="add-device-button"
            type="button"
            onClick={() => setIsAddModalOpen(true)}
          >
            <span aria-hidden="true">+</span>
            Add device
          </button>
        </section>

        <section className="summary-section" aria-labelledby="summary-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">At a glance</p>
              <h2 id="summary-heading">Support overview</h2>
            </div>
            <p>{devices.length} {devices.length === 1 ? 'device' : 'devices'} shown</p>
          </div>

          <div className="summary-grid">
            {Object.entries(STATUS_DETAILS).map(([status, details]) => (
              <article className={`summary-card status-${status.toLowerCase()}`} key={status}>
                <div className="summary-topline">
                  <span className="status-dot" aria-hidden="true" />
                  <span>{details.label}</span>
                </div>
                <strong>{statusCounts[status]}</strong>
                <p>{details.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="devices-section" aria-labelledby="devices-heading">
          <div className="section-heading inventory-heading">
            <div>
              <p className="eyebrow">Inventory</p>
              <h2 id="devices-heading">Your devices</h2>
            </div>
            <div className="filter-preview" aria-label="Filter devices by owner">
              <button
                className={`filter-chip ${!selectedOwnerId ? 'filter-chip--active' : ''}`}
                type="button"
                onClick={() => setSelectedOwnerId('')}
              >
                Everyone
              </button>
              {ownersQuery.data.allOwners.map((owner) => (
                <button
                  className={`filter-chip ${selectedOwnerId === owner.id ? 'filter-chip--active' : ''}`}
                  key={owner.id}
                  type="button"
                  onClick={() => setSelectedOwnerId(owner.id)}
                >
                  {owner.name}
                </button>
              ))}
            </div>
          </div>

          {devices.length === 0 ? (
            <div className="empty-state">
              <span aria-hidden="true">+</span>
              <h3>No devices found</h3>
              <p>Add a device or choose a different owner.</p>
            </div>
          ) : (
            <div className="device-grid">
              {devices.map((device) => {
                const status = STATUS_DETAILS[device.model.status]
                return (
                  <article
                    className="device-card"
                    key={device.id}
                    role="button"
                    tabIndex="0"
                    onClick={() => openDevice(device)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        openDevice(device)
                      }
                    }}
                  >
                    <div className="device-card__topline">
                      <span className={`status-badge status-${device.model.status.toLowerCase()}`}>
                        <span className="status-dot" aria-hidden="true" />
                        {status.label}
                      </span>
                      <span className="owner-label">{device.owner.name}</span>
                    </div>

                    <div className="device-heading">
                      <span className="device-icon" aria-hidden="true">
                        {device.model.product.toLowerCase().includes('router') ? '⌁' : '▣'}
                      </span>
                      <div>
                        <h3>{device.nickname}</h3>
                        <p>{device.model.company} {device.model.product} {device.model.version}</p>
                      </div>
                    </div>

                    <dl className="device-details">
                      <div>
                        <dt>Support ends</dt>
                        <dd>{formatDate(device.model.supportEndsOn)}</dd>
                      </div>
                      <div>
                        <dt>Purchased</dt>
                        <dd>{device.purchasedOn ? formatDate(device.purchasedOn) : 'Unknown'}</dd>
                      </div>
                    </dl>
                    <p className="device-advice">{status.description}</p>
                  </article>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {isAddModalOpen && (
        <div className="overlay" role="presentation" onMouseDown={closeAddModal}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-device-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="close-button" type="button" aria-label="Close" onClick={closeAddModal}>×</button>
            <p className="eyebrow">New inventory item</p>
            <h2 id="add-device-title">Add a device</h2>
            <p className="panel-description">Choose an owner and model, then add a recognizable name.</p>
            <DeviceForm
              values={newDevice}
              owners={ownersQuery.data.allOwners}
              models={modelsQuery.data.allModels}
              onChange={updateForm(setNewDevice)}
              onSubmit={handleAddDevice}
              onCancel={closeAddModal}
              loading={addDeviceResult.loading}
              error={addDeviceResult.error}
              submitLabel="Add device"
            />
          </section>
        </div>
      )}

      {selectedDevice && (
        <div className="drawer-layer" role="presentation" onMouseDown={closeDrawer}>
          <aside
            className="device-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="device-drawer-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="close-button" type="button" aria-label="Close" onClick={closeDrawer}>×</button>
            <p className="eyebrow">Device details</p>
            <h2 id="device-drawer-title">{selectedDevice.nickname}</h2>

            {isEditing ? (
              <DeviceForm
                values={editDevice}
                owners={ownersQuery.data.allOwners}
                models={modelsQuery.data.allModels}
                onChange={updateForm(setEditDevice)}
                onSubmit={handleUpdateDevice}
                onCancel={() => setIsEditing(false)}
                loading={updateDeviceResult.loading}
                error={updateDeviceResult.error}
                submitLabel="Save changes"
              />
            ) : (
              <>
                <span className={`status-badge status-${selectedDevice.model.status.toLowerCase()}`}>
                  <span className="status-dot" aria-hidden="true" />
                  {STATUS_DETAILS[selectedDevice.model.status].label}
                </span>
                <dl className="drawer-details">
                  <div><dt>Owner</dt><dd>{selectedDevice.owner.name}</dd></div>
                  <div>
                    <dt>Model</dt>
                    <dd>{selectedDevice.model.company} {selectedDevice.model.product} {selectedDevice.model.version}</dd>
                  </div>
                  <div><dt>Support ends</dt><dd>{formatDate(selectedDevice.model.supportEndsOn)}</dd></div>
                  <div><dt>Purchased</dt><dd>{selectedDevice.purchasedOn ? formatDate(selectedDevice.purchasedOn) : 'Unknown'}</dd></div>
                </dl>

                {(updateDeviceResult.error || deleteDeviceResult.error) && (
                  <p className="form-error" role="alert">
                    {updateDeviceResult.error?.message || deleteDeviceResult.error?.message}
                  </p>
                )}

                {isConfirmingDelete ? (
                  <div className="delete-confirmation">
                    <p>Delete “{selectedDevice.nickname}”? This can’t be undone.</p>
                    <div className="form-actions">
                      <button className="secondary-button" type="button" onClick={() => setIsConfirmingDelete(false)}>Cancel</button>
                      <button className="danger-button" type="button" onClick={handleDeleteDevice} disabled={deleteDeviceResult.loading}>
                        {deleteDeviceResult.loading ? 'Deleting...' : 'Delete device'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="drawer-actions">
                    <button className="danger-text-button" type="button" onClick={() => setIsConfirmingDelete(true)}>Delete</button>
                    <button className="primary-button" type="button" onClick={() => setIsEditing(true)}>Edit device</button>
                  </div>
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </main>
  )
}

function DeviceForm({
  values,
  owners,
  models,
  onChange,
  onSubmit,
  onCancel,
  loading,
  error,
  submitLabel,
}) {
  return (
    <form className="device-form" onSubmit={onSubmit}>
      <label>
        Nickname
        <input name="nickname" type="text" value={values.nickname} onChange={onChange} placeholder="My work laptop" required />
      </label>
      <label>
        Owner
        <select name="ownerId" value={values.ownerId} onChange={onChange} required>
          <option value="">Select an owner</option>
          {owners.map((owner) => <option key={owner.id} value={owner.id}>{owner.name}</option>)}
        </select>
      </label>
      <label>
        Model
        <select name="modelId" value={values.modelId} onChange={onChange} required>
          <option value="">Select a model</option>
          {models.map((model) => (
            <option key={model.id} value={model.id}>{model.company} {model.product} {model.version}</option>
          ))}
        </select>
      </label>
      <label>
        Purchase date <span>Optional</span>
        <input name="purchasedOn" type="date" value={values.purchasedOn} onChange={onChange} />
      </label>
      {error && <p className="form-error" role="alert">Could not save device: {error.message}</p>}
      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
        <button className="primary-button" type="submit" disabled={loading}>
          {loading ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  )
}

export default App
