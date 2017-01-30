import * as React from 'react'
import * as fetch from 'isomorphic-fetch'
import {modalStyle} from './constants'
import * as Modal from 'react-modal'
import {Icon, $v} from 'graphcool-styles'
import Table from './SelectUserPopup/Table'
import SearchBox from './GraphiQL/DocExplorer/SearchBox'
import * as Immutable from 'seamless-immutable'

interface State {
  startIndex: number
  stopIndex: number
  users: any[]
  count: number
  query: string
  selectedRowIndex: number
}

interface Props {
  projectId: string
  adminAuthToken: string
  userFields: any[]
  onSelectUser: Function
  isOpen: boolean
  onRequestClose: Function
  endpointUrl: string
}

export default class SelectUserPopup extends React.Component<Props, State> {

  private style: any
  private lastQuery: string

  constructor(props) {
    super(props)

    this.state = {
      startIndex: 0,
      stopIndex: 50,
      users: Immutable([]),
      query: '',
      count: 0,
      selectedRowIndex: -1,
    }

    this.getUsers({startIndex: 0, stopIndex: 50}, props.userFields)

    this.style = Object.assign({}, modalStyle, {
      overlay: modalStyle.overlay,
      content: Object.assign({}, modalStyle.content, {
        width: 'auto',
        minWidth: '600px',
        maxWidth: window.innerWidth - 100 + 'px',
      }),
    })

    global['s'] = this
  }

  componentWillReceiveProps(nextProps) {
    const {startIndex, stopIndex} = this.state

    if (nextProps.userFields.length !== this.props.userFields.length) {
      this.getUsers({startIndex, stopIndex}, nextProps.userFields)
    }
  }

  render() {

    // put id to beginning
    return (
      <Modal
        isOpen={this.props.isOpen}
        onRequestClose={this.props.onRequestClose}
        contentLabel='Select a User'
        style={this.style}
      >
        <style jsx>{`
        .select-user-popup {
          @inherit: .bgWhite, .relative, .mh25;
        }
        .title-wrapper {
          @inherit: .flex, .w100, .itemsCenter, .justifyCenter, .bb, .bBlack10;
          padding: 45px;
        }
        .title {
          @inherit: .fw3, .f38;
          letter-spacing: 0.54px;
        }
        .search {
          @inherit: .absolute, .w100, .bbox, .ph38, .z2, .flex, .justifyCenter;
          margin-top: -24px;
        }
        .search-box {
          flex: 1 1 400px;
        }
      `}</style>
        <style jsx global>{`
          .popup-x {
            @inherit: .absolute, .right0, .top0, .pointer, .pt25, .pr25;
          }
        `}</style>
        <div className='select-user-popup'>
          <div className='title-wrapper'>
            <div className='title'>
              Select a User's view
            </div>
          </div>
          <Icon
            src={require('graphcool-styles/icons/stroke/cross.svg')}
            stroke={true}
            width={25}
            height={25}
            strokeWidth={2}
            className='popup-x'
            color={$v.gray50}
            onClick={this.props.onRequestClose}
          />
          <div className='search'>
            <div className='search-box'>
              <SearchBox
                placeholder='Search for a user ...'
                onSearch={this.handleSearch}
                isShown
                clean
              />
            </div>
          </div>
          <Table
            fields={this.props.userFields}
            rows={this.state.users}
            rowCount={this.state.count}
            loadMoreRows={this.getUsers}
            onRowSelection={this.handleRowSelection}
          />
        </div>
      </Modal>
    )
  }

  private handleRowSelection = ({index, rowData}) => {
    if (index === this.state.selectedRowIndex) {
      return
    }

    this.setState(state => {
      let {users} = state

      if (state.selectedRowIndex > -1) {
        users = Immutable.setIn(users, [state.selectedRowIndex, 'selected'], false)
      }

      users = Immutable.setIn(users, [index, 'selected'], true)

      return {
        ...state,
        users,
        selectedRowIndex: index,
      }
    })

    this.props.onSelectUser(rowData)
  }

  private handleSearch = (value) => {
    this.setState({query: value} as State, () => {
      const {startIndex, stopIndex} = this.state
      this.getUsers({startIndex, stopIndex})
    })
  }

  getUsers = ({startIndex, stopIndex}: {startIndex: number, stopIndex: number}, userFieldsInput?: string[]) => {
    const {query} = this.state
    const userFields = userFieldsInput || this.props.userFields

    if (userFields.length === 0) {
      return
    }

    let filter = ''
    if (query && query.length > 0) {
      filter = ' filter: { OR: ['

      const whiteList = ['ID', 'String', 'Enum']

      const filtered = userFields.filter(field => {
        const typeName = field.type.name || field.type.ofType.name
        return whiteList.indexOf(typeName) > -1
      })

      filter += filtered.map(field => `{${field.name}_contains: "${query}"}`).join(',\n')

      filter += ']}'
    }

    const count = stopIndex - startIndex
    const userQuery = `
      {
        _allUsersMeta {
          count
        }
        allUsers(skip: ${startIndex} first: ${count}${filter}){
          ${userFields.map(f => f.name).join('\n')}
        }
      }
    `

    fetch(this.props.endpointUrl, { // tslint:disable-line
      method: 'post',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.props.adminAuthToken}`,
        'X-GraphCool-Source': 'playground',
      },
      body: JSON.stringify({query: userQuery}),
    })
      .then(res => res.json())
      .then(res => {
        const {_allUsersMeta, allUsers} = res.data

        let {users} = this.state

        // reset data if search changed
        if (query !== this.lastQuery) {
          users = Immutable([])
        }

        allUsers.forEach((user, i) => {
          users = Immutable.set(users, (i + startIndex), user)
        })

        this.setState({
          users,
          count: _allUsersMeta.count,
        } as State)

        this.lastQuery = query
      })
      .catch(e => console.error(e))
  }
}