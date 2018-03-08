/*
Copyright 2015-2017 The OmniDB Team

This file is part of OmniDB.

OmniDB is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

OmniDB is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with OmniDB. If not, see http://www.gnu.org/licenses/.
*/

/// <summary>
/// Console state
/// </summary>
var v_consoleState = {
	Idle: 0,
	Executing: 1,
	Ready: 2
}

function appendToEditor(p_editor, p_text) {
  var v_last_row = p_editor.session.getLength() - 1;
  var v_last_col = p_editor.session.getLine(v_last_row).length;
  p_editor.session.insert({ row: v_last_row, column: v_last_col},p_text);
  p_editor.gotoLine(Infinity);
  p_editor.resize();
}

function clearConsole() {
  var v_tag = v_connTabControl.selectedTab.tag.tabControl.selectedTab.tag;
  v_tag.editor_console.setValue('>> Console tab. Type the commands in the editor below this box. \\? to view command list.');
  v_tag.editor_console.clearSelection();

}

function consoleSQL(p_check_command = true) {
  var v_tag = v_connTabControl.selectedTab.tag.tabControl.selectedTab.tag;
  var v_content = v_tag.editor_input.getValue().trim();
  //var v_cursor_position = v_tag.editor_input.getCursorPosition();
  //var v_last_row = v_tag.editor_input.session.getLength() - 1;
  //var v_last_col = v_tag.editor_input.session.getLine(v_last_row).length;

    //last character is semi-colon or first is backslash
  //if (!p_check_command || (v_content[v_content.length-1]==';' || v_content[0]=='\\') {
  if (!p_check_command || v_content[0]=='\\') {

    if (v_tag.state!=v_consoleState.Idle) {
  		showAlert('Tab with activity in progress.');
  	}
  	else {

      appendToEditor(v_tag.editor_console,'\n>> ' + v_content + '\n');
      v_tag.editor_input.setValue('');
      v_tag.editor_input.clearSelection();
      v_tag.editor_input.setReadOnly(false);

      var v_message_data = {
        v_sql_cmd : v_content,
        v_db_index: v_connTabControl.selectedTab.tag.selectedDatabaseIndex,
        v_tab_id: v_connTabControl.selectedTab.tag.tabControl.selectedTab.tag.tab_id
      }

      v_tag.editor_input.setReadOnly(true);

      var d = new Date,
      dformat = [(d.getMonth()+1).padLeft(),
                 d.getDate().padLeft(),
                 d.getFullYear()].join('/') +' ' +
                [d.getHours().padLeft(),
                 d.getMinutes().padLeft(),
                 d.getSeconds().padLeft()].join(':');

      var v_context = {
        tab_tag: v_tag,
        start_time: new Date().getTime(),
        start_datetime: dformat,
        database_index: v_connTabControl.selectedTab.tag.selectedDatabaseIndex,
        acked: false
      }
      v_context.tab_tag.context = v_context;

      sendWebSocketMessage(v_queryWebSocket, v_queryRequestCodes.Console, v_message_data, false, v_context);

      v_tag.state = v_consoleState.Executing;
      v_tag.tab_loading_span.style.display = '';
      v_tag.tab_check_span.style.display = 'none';
      v_tag.tab_stub_span.style.display = 'none';
      v_tag.bt_cancel.style.display = '';
      v_tag.query_info.innerHTML = 'Running...';

      setTimeout(function() {
        if (!v_context.acked) {
          cancelConsoleTab(v_context.tab_tag);
        }
      },20000);
    }
  }
}

function cancelConsole(p_tab_tag) {
  var v_tab_tag;
	if (p_tab_tag)
		v_tab_tag = p_tab_tag;
	else
		v_tab_tag = v_connTabControl.selectedTab.tag.tabControl.selectedTab.tag;

	var v_tab_tag = v_connTabControl.selectedTab.tag.tabControl.selectedTab.tag;
	sendWebSocketMessage(v_queryWebSocket, v_queryRequestCodes.CancelThread, v_tab_tag.tab_id, false);

	cancelConsoleTab(v_tab_tag);

}

function cancelConsoleTab(p_tab_tag) {

  var v_tab_tag;
	if (p_tab_tag)
		v_tab_tag = p_tab_tag;
	else
		v_tab_tag = v_connTabControl.selectedTab.tag.tabControl.selectedTab.tag;

	if(v_tab_tag.editor_input) {
		v_tab_tag.editor_input.setReadOnly(false);
	}

	v_tab_tag.state = v_consoleState.Idle;
	v_tab_tag.tab_loading_span.style.display = 'none';
	v_tab_tag.tab_check_span.style.display = 'none';
	v_tab_tag.tab_stub_span.style.display = '';
	v_tab_tag.bt_cancel.style.display = 'none';
	v_tab_tag.query_info.innerHTML = 'Canceled.';

	removeContext(v_queryWebSocket,v_tab_tag.context.v_context_code);

	SetAcked(v_tab_tag.context);

}

function checkConsoleStatus(p_tab) {

	if (p_tab.tag.state == v_consoleState.Ready) {
		consoleReturnRender(p_tab.tag.data,p_tab.tag.context);
	}
}

function consoleReturn(p_data,p_context) {

	//If query wasn't canceled already
	if (p_context.tab_tag.state!=v_consoleState.Idle) {

		if (p_context.tab_tag.tab_id == p_context.tab_tag.tabControl.selectedTab.id && p_context.tab_tag.connTab.id == p_context.tab_tag.connTab.tag.connTabControl.selectedTab.id) {
			consoleReturnRender(p_data,p_context);
		}
		else {
			p_context.tab_tag.state = v_consoleState.Ready;
			p_context.tab_tag.context = p_context;
			p_context.tab_tag.data = p_data;

			p_context.tab_tag.tab_loading_span.style.display = 'none';
			p_context.tab_tag.tab_check_span.style.display = '';

		}
	}
}

function consoleReturnRender(p_message,p_context) {
  p_context.tab_tag.state = v_consoleState.Idle;

  var v_tag = p_context.tab_tag;

  v_tag.editor_input.setReadOnly(false);
  if (p_message.v_error)
    appendToEditor(v_tag.editor_console,p_message.v_data.message);
  else {
    if (p_message.v_data.v_notices_length > 0)
      appendToEditor(v_tag.editor_console,p_message.v_data.v_notices + p_message.v_data.v_data);
    else
      appendToEditor(v_tag.editor_console,p_message.v_data.v_data);
  }
  v_tag.editor_input.setValue('');
  v_tag.editor_input.clearSelection();

  v_tag.query_info.innerHTML = '';
  v_tag.tab_loading_span.style.display = 'none';
  v_tag.tab_check_span.style.display = 'none';
  v_tag.bt_cancel.style.display = 'none';


}